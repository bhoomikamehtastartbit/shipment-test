const jwt = require('jsonwebtoken');
const Users = require('../models/user');
const Session = require('../models/session000');
const Roles = require('../models/role');
const Plants = require('../models/plant000');
const TransportCompany = require('../models/transportCompany000');
const AuthController = require('../controllers/MobileUser000');
const { mockRequest, mockResponse } = require('./intercepter00');

jest.mock('../models/user');
jest.mock('../models/session');
jest.mock('../models/role');
jest.mock('../models/plant');
jest.mock('../models/transportCompany');

describe('UserLogin Controller', () => {
  let req, res;

const mockUser = {
  _id: '683445868a96052b38b1de58',
  username: 'logi1',
  email: 'testlogi1@gmail.com',
  password: 'Root@123',
  roleid: '68344037127147c0e74c86ff',
  plantId: '683444e9e9095c3bd360ce0e',
  transport_company_id: 'company123',
  push_notifications: [],
};

beforeEach(() => {
  req = mockRequest({
    body: {
      username: 'logi1',
    }
  });
  res = mockResponse();
  jest.clearAllMocks();
});


  const mockRole = {
    _id: '68344037127147c0e74c86ff',
    name: 'Logistic Person',
    slug: 'logistic_person',
  };

  const mockPlant = {
    _id: '683440eb127147c0e74c8703',
    name: 'Bhiwadi Plant',
  };

  const mockCompany = [{
    _id: '683446782c7e6bf9e0719dde',
    name: 'HTL',
  }];

  beforeEach(() => {
    req = mockRequest({
      body: {
        emailOrUsername: 'logi1',
        password: 'Root@123',
      }
    });
    res = mockResponse();
    jest.clearAllMocks();
  });

  it('should login Munshi user and return access token with company info', async () => {
    Users.findOne.mockResolvedValue(mockUser);
    Users.updateOne.mockResolvedValue(); // for push_notifications
    Roles.findById.mockResolvedValue(mockRole);
    TransportCompany.find.mockResolvedValue(mockCompany);
    Session.prototype.save = jest.fn().mockResolvedValue();

    process.env.JWT_SECRET = 'testsecret';
    process.env.JWT_EXPIRATION = '2d';

    await AuthController.UserLogin(req, res, jest.fn());

    expect(Users.findOne).toHaveBeenCalled();
    expect(Roles.findById).toHaveBeenCalledWith(mockUser.roleid);
    expect(TransportCompany.find).toHaveBeenCalledWith({ _id: mockUser.transport_company_id });
    expect(Session.prototype.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: expect.any(String),
      user: mockUser,
      roles: mockRole,
      company: mockCompany,
    }));
  });

  it('should login non-Munshi user and return plant info', async () => {
    const roleWithoutMunshi = { ...mockRole, slug: 'logistic_person' };
    Users.findOne.mockResolvedValue(mockUser);
    Users.updateOne.mockResolvedValue();
    Roles.findById.mockResolvedValue(roleWithoutMunshi);
    Plants.findById.mockResolvedValue(mockPlant);
    Session.prototype.save = jest.fn().mockResolvedValue();

    await AuthController.UserLogin(req, res, jest.fn());

    expect(Roles.findById).toHaveBeenCalled();
    expect(Plants.findById).toHaveBeenCalledWith(mockUser.plantId);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: expect.any(String),
      user: mockUser,
      roles: roleWithoutMunshi,
      plant: mockPlant,
    }));
  });

  it('should return 400 if user not found', async () => {
    Users.findOne.mockResolvedValue(mockUser);

    await AuthController.UserLogin(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  it('should return 400 for invalid password', async () => {
    Users.findOne.mockResolvedValue(mockUser);

    await AuthController.UserLogin(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
  });

  it('should handle error and call next', async () => {
    const next = jest.fn();
    Users.findOne.mockRejectedValue(mockUser);

    await AuthController.UserLogin(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
