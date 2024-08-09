const express = require("express");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const fs = require('fs');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();

app.use(bodyParser.json());
app.use(cors());
require('dotenv').config();

mongoose.connect(process.env.MONGO_DB_URL, {
  // useNewUrlParser: true,
  // useUnifiedTopology: true
}).then(() => {
  console.log("MongoDB Connected Successfully");
}).catch((err) => {
  console.error(err);
});

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadFolder = 'uploads/';
    fs.mkdirSync(uploadFolder, { recursive: true }); // Create the folder if it doesn't exist
    cb(null, uploadFolder);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // Unique filename
  }
});

const upload = multer({ storage: storage });

// Student schema and model
const studentSchema = new mongoose.Schema({
  studentName: String,
  courseName: String,
  certificateNumber: String,
  passingYear: String,
  courseDuration: String,
  skills: String,
  qrCode: String,
  certificateId: String, // Added this field to the schema
  imageUrl: String, // New field for image URL
});

const Student = mongoose.model("Student", studentSchema);

app.post("/api/students", upload.single('image'), async (req, res) => {
  const {
    studentName,
    courseName,
    certificateNumber,
    passingYear,
    courseDuration,
    skills,
  } = req.body;
  const certificateId = new mongoose.Types.ObjectId();
  const qrCodeUrl = await QRCode.toDataURL(
    `${process.env.STRAPI}/student/${certificateId.toString()}`
  );

  const imageUrl = req.file ? req.file.path : ''; // Get the uploaded image URL

  const student = new Student({
    studentName,
    courseName,
    certificateNumber,
    passingYear,
    courseDuration,
    skills,
    certificateId: certificateId.toString(), // Assign certificateId here
    qrCode: qrCodeUrl,
    imageUrl: imageUrl, // Assign the image URL to the imageUrl field
  });

  await student.save();
  res.send(student);
});

app.get("/api/students", async (req, res) => {
  try {
    const students = await Student.find();
    res.send(students);
  } catch (error) {
    res.status(500).send({ message: "Server Error" });
  }
});

app.get("/api/students/:id", async (req, res) => {
  try {
    const student = await Student.findOne({
      certificateId: req.params.id, // Use certificateId instead of id
    });
    if (student) {
      res.send(student);
    } else {
      res.status(404).send({ message: "Student not found" });
    }
  } catch (error) {
    res.status(500).send({ message: "Server Error" });
  }
});

// User schema and model
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
});

const User = mongoose.model("User", userSchema);

// Register route
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();
    res.status(201).send({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).send({ message: "Server Error" });
  }
});

// Login route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).send({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.send({ token });
  } catch (error) {
    res.status(500).send({ message: "Server Error" });
  }
});

// Protect routes using middleware (optional)
const authMiddleware = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(401).send({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized" });
    }
    req.userId = decoded.userId;
    next();
  });
};

// Use this middleware to protect routes
app.get("/api/protected", authMiddleware, (req, res) => {
  res.send({ message: "This is a protected route" });
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
