const bcrypt = require('bcryptjs');

// Function to hash a password
const hashPassword = async (password) => {
    try {
        const saltRounds = 10; // Number of rounds to generate the salt (the higher, the more secure)
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log("Hashed Password: ", hashedPassword);
        return hashedPassword;
    } catch (error) {
        console.error("Error hashing password: ", error);
    }
}

// Function to compare a plaintext password with a hashed password
const comparePassword = async (inputPassword, storedHashedPassword) => {
    try {
        const match = await bcrypt.compare(inputPassword, storedHashedPassword);
        if (match) {
            console.log("Password is correct!");
        } else {
            console.log("Password is incorrect!");
        }
        return match;
    } catch (error) {
        console.error("Error comparing passwords: ", error);
    }
}

// Export the functions for use in other files
module.exports = { hashPassword, comparePassword };
