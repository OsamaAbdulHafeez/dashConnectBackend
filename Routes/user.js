// Routes/user.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
require("dotenv/config");
const tokenVerification = require("../config/tokenVerification");
const Story = require("../models/story");
const mongoose = require("mongoose");
const Company = require("../models/Company"); 
const nodemailer = require('nodemailer')
const multer  = require('multer')
const Images = require('../models/Images')
 

// create --> user API
router.post("/create", async (req, res) => {
  try {
      const { companyName, updateDate, Status, firstName, lastName, email, password } = req.body;

      const company = await Company.create({
          companyName,
          updateDate,
          Status,
      });

      const hashedPassword = bcrypt.hashSync(password, 10); // Hash the password

      const user = await User.create({
          firstName,
          lastName,
          email,
          password: hashedPassword, // Store the hashed password
          company: {  
              _id: company._id, 
              companyName: company.companyName,
              updateDate: company.updateDate,
              Status: company.Status,
          },
      });

      const userWithCompany = await User.findById(user._id);

      res.status(201).json({ user: userWithCompany });
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
});




// create --> Add employee API
router.post("/addEmployee", tokenVerification, async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;
    
    // Extract ID from token
    const userIdFromToken = req.userIdFromToken;

    // Fetch user
    const user = await User.findById(userIdFromToken);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Extract company data
    const company = user.company;

    // Input validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Check for existing email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use." });
    }

   
    const hashedPassword = bcrypt.hashSync(password, 10);

    
    const newUser = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: role || "employee", 
      company: {
        _id: company._id, 
        companyName: company.companyName,
        updateDate: company.updateDate,
        Status: company.Status,
      },
    });

    res.status(201).json({ user: newUser });
  } catch (error) {
    console.error("Error adding employee:", error);
    res.status(500).json({ message: error.message });
  }
});
 



// create --> Login API
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user) {
      const checkPassword = bcrypt.compareSync(password, user.password); // Compare plaintext with hashed

      if (checkPassword) {
        const token = jwt.sign(
          { id: user._id, email: user.email },
          process.env.JWT_SECRET
        );
        res.status(200).send({
          status: 200,
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            companyName: user.companyName,
          },
          message: "Login successful",
          token,
        });
      } else {
        res.status(401).send({ status: 401, message: "Incorrect Password" });
      }
    } else {
      res.status(404).send({ status: 404, message: "User not found" });
    }
  } catch (error) {
    console.error("loginError", error);
    res.status(500).send({ status: 500, error: "Internal Server Error" });
  }
});





// create --> Update Employee
router.put("/updateEmployee", tokenVerification, async (req, res) => {
  try {
      const { employeeId, firstName, lastName, email, password, role } = req.body; // Get employeeId from the request body

      // Validate the employee ID
      if (!mongoose.isValidObjectId(employeeId)) {
          return res.status(400).send({ status: 400, message: "Invalid employee ID" });
      }

      // Fetch the logged-in user's company details
      const userIdFromToken = req.userIdFromToken; // Get user ID from token
      const user = await User.findById(userIdFromToken).select('company');

      if (!user) {
          return res.status(404).send({ message: "User not found" });
      }

      // Check if employee belongs to the logged-in user's company
      const employee = await User.findById(employeeId);
      if (!employee || employee.company._id.toString() !== user.company._id.toString()) {
          return res.status(403).send({ message: "You are not authorized to update this employee." });
      }

      // Update the employee details
      const updatedEmployee = await User.findByIdAndUpdate(
          employeeId,
          {
              firstName,
              lastName,
              email,
              password: password ? bcrypt.hashSync(password, 10) : employee.password, // Hash password only if it's provided
              role,
          },
          { new: true, runValidators: true } // Return the updated document and run validators
      );

      if (!updatedEmployee) {
          return res.status(404).send({ status: 404, message: "Employee not found" });
      }

      res.status(200).send({ message: "Employee updated successfully", employee: updatedEmployee });
  } catch (err) {
      console.error("Error updating employee", err);
      res.status(500).send({ message: "Error updating employee", error: err });
  }
});





// create --> Delete Employee
router.delete("/deleteEmployee", tokenVerification, async (req, res) => {
  try {
      const { employeeId } = req.body; // Get employeeId from the request body

      // Validate the employee ID
      if (!mongoose.isValidObjectId(employeeId)) {
          return res.status(400).send({ status: 400, message: "Invalid employee ID" });
      }

      // Fetch the logged-in user's company details
      const userIdFromToken = req.userIdFromToken; // Get user ID from token
      const user = await User.findById(userIdFromToken).select('company');

      if (!user) {
          return res.status(404).send({ message: "User not found" });
      }

      // Check if employee belongs to the logged-in user's company
      const employee = await User.findById(employeeId);
      if (!employee || employee.company._id.toString() !== user.company._id.toString()) {
          return res.status(403).send({ message: "You are not authorized to delete this employee." });
      }

      const deletedEmployee = await User.findByIdAndDelete(employeeId);

      if (!deletedEmployee) {
          return res.status(404).send({ status: 404, message: "Employee not found" });
      }

      res.status(200).send({ message: "Employee deleted successfully", employee: deletedEmployee });
  } catch (err) {
      console.error("Error deleting employee", err);
      res.status(500).send({ message: "Error deleting employee", error: err });
  }
});
 
//  create --> Nuke Users API. It will delete all users from users collection
router.delete("/nukeUsers", async (req, res) => {
  try {
    await User.deleteMany({}); // This command delete all users

    res.status(200).json({ message: "All users have been deleted." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// create --> Nuke Companies API. It will delete all companies from companies collection
router.delete("/nukeCompanies", async (req, res) => {
  try {
    await Company.deleteMany({}); // This command delete all companies

    res.status(200).json({ message: "All companies have been deleted." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// create --> Select API to fetch all users in the same company
router.get("/selectAllUsers", tokenVerification, async (req, res) => {
  try {
    // Retrieve user ID from token
    const userIdFromToken = req.userIdFromToken;

    // Find the user and get their company ID
    const user = await User.findById(userIdFromToken);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const companyId = user.company._id;

    // Find all users associated with the same company ID
    const usersInCompany = await User.find({ "company._id": companyId });

    // Return the list of users in the same company
    res.status(200).json({ users: usersInCompany });
  } catch (error) {
    console.error("Error fetching users in company:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});




// Change Pssword

router.put("/changePassword", tokenVerification, async (req, res) => {
  try {
    const {oldPassword, newPassword } = req.body; 
    const userId = req.userIdFromToken;
  
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const checkPassword = bcrypt.compareSync(oldPassword, user.password);

    if(!checkPassword) {
      return res.status(400).send({ message: "Incorrect old password" });
    } 

      user.password = bcrypt.hashSync(newPassword, 10); ;
      await user.save();
      res.status(200).send({ message: "Password changed successfully" });
      
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).send({ message: "Internal server error" });
    }
});






// Forgot Password Route

// router.post('/forgotPassword', (req, res) => {
//   const {email} = req.body;
//   User.findOne({email: email})
//   .then(user => {
//       if(!user) {
//           return res.send({Status: "User not existed"})
//       } 
//       const token = jwt.sign({id: user._id}, "jwt_secret_key", {expiresIn: "1d"})
//       var transporter = nodemailer.createTransport({
//           service: 'gmail',
//           auth: {
//             user: 'youremail@gmail.com',
//             pass: 'your password'
//           }
//         });
        
//         var mailOptions = {
//           from: 'youremail@gmail.com',
//           to: 'user email@gmail.com',
//           subject: 'Reset Password Link',
//           text: `http://localhost:5173/reset_password/${user._id}/${token}`
//         };
        
//         transporter.sendMail(mailOptions, function(error, info){
//           if (error) {
//             console.log(error);
//           } else {
//             return res.send({Status: "Success"})
//           }
//         });
//   })
// })



// Upload picture api

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Project's uploads folder
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });


// Upload profile picture for logged-in users
router.post("/uploadImage", tokenVerification, upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ status: 'No file uploaded' });

  const imageName = req.file.filename;

  try {
    // Update or create profile picture for the user
    const existingImage = await Images.findOne({ userId: req.user.id });
    if (existingImage) {
      existingImage.image = imageName;
      await existingImage.save();
    } else {
      await Images.create({ image: imageName, userId: req.user.id });
    }
    res.json({ status: "ok", image: imageName });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get profile picture of the logged-in user
router.get("/getProfilePicture", tokenVerification, async (req, res) => {
  try {
    const userImage = await Images.findOne({ userId: req.user.id });
    if (!userImage) {
      return res.status(404).json({ status: 'No profile picture found' });
    }
    res.json({ status: "ok", image: userImage.image });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;