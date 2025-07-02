const jwt = require('jsonwebtoken');
const Users = require('../models/user');
const { generateJWT } = require('../utils/generateJWT');
const { generateRefreshToken } = require('../utils/generateRefreshToken');
const Roles = require("../models/role")

// Controller to login the user and return both access and refresh tokens
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    // Check if the user exists
    const user = await Users.findOne({ email }).populate("roleid")



    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }



    if (user?.roleid?.slug === "admin") {


      // Check if the password is correct
      const isMatch = user?.password === password;

      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid email or password' });
      }

      // Generate JWT tokens
      const accessToken = await generateJWT(user._id);
      const refreshToken = await generateRefreshToken(user._id);





      // Send response with both the access token and refresh token
      return res.status(200).json({
        issuccess: true,
        message: 'Login successful',
        accessToken,
        refreshToken,
        user
      });
    } else {
      return res.status(200).json({
        issuccess: false,
        message: 'Only admin users are allowed to log in to the dashboard.'
      });

    }




  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};


// Controller to refresh the access token using the refresh token
const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token is required' });
  }

  try {
    // Verify the refresh token
    jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid refresh token' });
      }

      // Generate a new access token
      const newAccessToken = generateJWT(decoded.id);

      // Send the new access token
      res.status(200).json({ accessToken: newAccessToken });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { loginUser, refreshAccessToken };
