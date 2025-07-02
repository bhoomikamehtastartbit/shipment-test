const jwt = require('jsonwebtoken');

// Secret key used to sign the JWT token (ensure this is stored securely)
const JWT_SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key';

// Middleware function to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.header('authorization')?.replace('Bearer ', ''); // Extract token from Authorization header

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        // jwt.verify will automatically throw an error if the token is expired or invalid
        const decoded = jwt.verify(token, JWT_SECRET_KEY);

        req.user = decoded; // Attach decoded payload to request
        next(); // Proceed
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token has expired. Please log in again.', tokenExpired: true });
        }

        return res.status(400).json({ message: 'Invalid token.', tokenExpired: true });
    }
};

module.exports = verifyToken;
