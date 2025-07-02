const Shipments = require("../../models/shipment");
const bulkupload = require("../../models/bulkupload");
const bulkuploadLog = require("../../models/bulkuploadLog");
const Counter = require("../../models/shipmentCounter");
const Plants = require("../../models/plant");
const TruckTypes = require("../../models/truckType")
const Users = require('../../models/user');
const mongoose = require("mongoose");

const getAllShipments = async (req, res, next) => {
    try {
        const {
            page_size = 10,
            page_no = 1,
            search = '',
            plant_id
        } = req.query;


        if (!plant_id) {
            return res.status(400).json({
                error: true,
                message: "Plant ID is required."
            });
        }



        const skip = (page_no - 1) * page_size;
        const limit = parseInt(page_size);
        const sortOrder = -1;

        const searchFilter = search
            ? {
                $or: [
                    { 'dock_number': { $regex: search, $options: 'i' } },
                    { 'shipment_status': { $regex: search, $options: 'i' } },
                    { 'shipment_number': { $regex: search, $options: 'i' } }]
            }
            : {};



        // Combine filters
        let filters = {
            ...searchFilter,
            active: true,
            plantId: plant_id,
            // isbulkupload: true
        };

        const totalShipments = await Shipments.countDocuments(filters);

        let shipments = await Shipments.find(filters)
            .populate({
                path: 'companyId',
                populate: {
                    path: 'munshiId',
                    model: 'Users',
                    select: '',
                },
                select: '',
            })
            .populate('truckTypeId', '')
            .populate('createdBy', '')
            .populate('TruckId', '')
            .sort({ created_at: sortOrder })
            .skip(skip)
            .limit(limit)
            .exec();

        const totalCount = await Shipments.countDocuments(filters);

        res.status(200).json({
            totalCount,
            shipments,
            page_size: parseInt(page_size),
            page_no: parseInt(page_no),
            total_pages: Math.ceil(totalShipments / page_size),
            has_next: (page_no * page_size) < totalShipments,
            has_prev: page_no > 1
        });
    } catch (error) {
        next(error);
    }
};


const BulkuploadShipments = async (req, res) => {


    const { records, plant_id } = req.body

    if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ message: "No records provided for upload." });
    }

    const session = await bulkupload.startSession();
    session.startTransaction();

    try {
        const bulkEntry = await bulkupload.create({
            type: "shipment_upload",
            status: "pending",
            plantId: plant_id
        });

        let successCount = 0;
        let failCount = 0;

        const users = await Users?.find({ plantId: plant_id })
            .populate({
                path: "roleid",
                match: { slug: "logistic_person" }
            })



        for (const entry of records) {
            try {

                const {
                    destination_city,
                    destination_state,
                    invoice_number,
                    truck_type_code
                } = entry;

                // Find truck type by code
                const trucktype = await TruckTypes.findOne({ truck_code: truck_type_code });

                if (!trucktype) {
                    await bulkuploadLog.create({
                        bulkuploadid: bulkEntry._id,
                        massage: `Truck type with code '${truck_type_code}' not found.`,
                        records: entry
                    });
                    failCount++;
                    continue;
                }


                const counter = await Counter.findOneAndUpdate(
                    { _id: "shipment_number" },
                    { $inc: { sequence_value: 1 } },
                    { new: true, upsert: true }
                );

                const newShipmentNumber = `SHIP-${counter.sequence_value.toString().padStart(6, "0")}`;


                // Save shipment if truck type is found
                await Shipments.create({
                    destination_state,
                    destination_city,
                    invoice_number,
                    truckTypeId: trucktype._id,
                    shipment_status: "Planned",
                    shipment_number: newShipmentNumber,
                    bulkuploadid: bulkEntry._id,
                    plantId: plant_id,
                    active: true,
                    isbulkupload: true,
                    updatedBy: users[0]?._id ?? null,
                    createdBy: users[0]?._id ?? null
                });

                successCount++;

            } catch (err) {
                await bulkuploadLog.create({
                    bulkuploadid: bulkEntry._id,
                    massage: `Error saving record: ${err.message}`,
                    records: entry
                });
                failCount++;
            }
        }

        let finalStatus = 'pending';
        if (successCount === 0) finalStatus = 'failed';
        else if (failCount === 0) finalStatus = 'success';

        await bulkupload.findByIdAndUpdate(bulkEntry._id, {
            status: finalStatus,
            total_error: failCount,
            total_success: successCount,
            total_records: records.length
        });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            message: "Shipment bulk upload completed.",
            success: successCount,
            failed: failCount,
            status: finalStatus,
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Shipment Bulk Upload Error:", error);
        return res.status(500).json({ message: "Server error during bulk upload." });
    }
};


const getShipmentBulkuploads = async (req, res, next) => {
    const { page_size, page_no, plant_id } = req.body;

    const pageSize = parseInt(page_size) || 10;
    const pageNo = parseInt(page_no) || 1;
    const skip = (pageNo - 1) * pageSize;

    const plantIdFilter = plant_id ? { plantId: new mongoose.Types.ObjectId(plant_id) } : {};

    try {
        const uploads = await bulkupload
            .find({ type: 'shipment_upload', ...plantIdFilter })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(pageSize);

        const totalCount = await bulkupload.countDocuments({ type: 'shipment_upload', plantId: plant_id });

        res.status(200).json({
            totalCount,
            currentPage: pageNo,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
            records: uploads
        });

    } catch (error) {
        next(error);
    }
};


const getSuccessShipmentRecordsByBulkId = async (req, res, next) => {
    const { page_size, page_no, bulkuploadid } = req.body;

    if (!bulkuploadid) {
        return res.status(400).json({ message: "Missing bulkuploadid", success: false });
    }
    const pageSize = parseInt(page_size) || 10;
    const pageNo = parseInt(page_no) || 1;
    const skip = (pageNo - 1) * pageSize;

    try {
        const successRecords = await Shipments.find({ bulkuploadid })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(pageSize);

        const totalCount = await Shipments.countDocuments({ bulkuploadid });

        res.status(200).json({
            success: true,
            totalCount,
            currentPage: pageNo,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
            records: successRecords
        });

    } catch (error) {
        next(error);
    }
};



const getErrorShipmentRecordsByBulkId = async (req, res, next) => {
    const { page_size, page_no, bulkuploadid } = req.body;

    if (!bulkuploadid) {
        return res.status(400).json({ message: "Missing bulkuploadid", success: false });
    }

    const pageSize = parseInt(page_size) || 10;
    const pageNo = parseInt(page_no) || 1;
    const skip = (pageNo - 1) * pageSize;

    try {
        const errorLogs = await bulkuploadLog.find({ bulkuploadid })
            .skip(skip)
            .limit(pageSize)
            .sort({ created_at: -1 });

        const totalCount = await bulkuploadLog.countDocuments({ bulkuploadid });

        res.status(200).json({
            success: true,
            totalCount,
            currentPage: pageNo,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
            errors: errorLogs
        });

    } catch (error) {
        next(error);
    }
};

module.exports = { getAllShipments, BulkuploadShipments, getShipmentBulkuploads, getSuccessShipmentRecordsByBulkId, getErrorShipmentRecordsByBulkId };
