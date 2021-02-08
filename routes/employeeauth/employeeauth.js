const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

const mongodb = require("mongodb")
const objectId = mongodb.ObjectID

//VALIDATION OF USER INPUTS PREREQUISITES
const Joi = require("@hapi/joi");

const registerSchema = Joi.object({
  fname: Joi.string().min(3).required(),
  lname: Joi.string().min(3).required(),
  email: Joi.string().min(6).required().email(),
  password: Joi.string().min(6).required(),
  spAccessValue : Joi.string().min(2).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().min(6).required().email(),
  password: Joi.string().min(6).required(),
});

//ADMIN/MANAGER TOKEN VERIFICATIOn
const registerVerify = require("./registerVerify");

//SIGNUP USER
router.post("/register", registerVerify, async (req, res) => {

  //CHECKING IF USER EMAIL ALREADY EXISTS
  const emailExist = await User.findOne({ email: req.body.email });
  if (emailExist) res.status(400).send("Email already exists");

  //HASHING THE PASSWORD

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(req.body.password, salt);

  //ON PROCESS OF ADDING NEW USER

  const user = new User({
    fname: req.body.fname,
    lname: req.body.lname,
    email: req.body.email,
    password: hashedPassword,
    spAccessValue: req.body.spAccessValue,
    type: "employee",
  });

  try {
    //VALIDATION OF USER INPUTS
    const { error } = await registerSchema.validateAsync(req.body);

    if (error) {
      return res.status(400).send(error.details[0].message);
    }
    else {
      //NEW USER IS ADDED
      const saveUser = await user.save();
      res.send("user created");
    }
  } catch (error) {
    console.log("Check4: error is: "+ error);
    res.status(400).send(error);
  }
});

//SIGNIN USER

router.post("/login", async (req, res) => {
  //CHECKING IF USER EMAIL EXISTS

  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).send("Incorrect Email- ID");

  //CHECKING IF USER PASSWORD MATCHES
  let salt = await bcrypt.genSalt(10); 
  let encryptedPassword = await bcrypt.hash(req.body.password, salt);
  console.log("encrypted entered password is: " + encryptedPassword);
  const validPassword = await bcrypt.compare(req.body.password, user.password);
  if (!validPassword){
    console.log("req.body.password is: " + req.body.password + " and password in db is:" + user.password);
    return res.status(400).send("Incorrect Password");
  } 
  try {
    //VALIDATION OF USER INPUTS
    const { error } = await loginSchema.validateAsync(req.body);
    console.log("reaching here: ");
    if (error) return res.status(400).send(error.details[0].message);
    else {
      if (user.type === "employee") {
        const token = jwt.sign(
          { _id: user._id },
          process.env.EMPLOYEE_TOKEN_SECRET
        );

        res.setHeader("auth-token", token);
        res.status(200).json({
          token: token,
          spAccessValue: user.spAccessValue
        });
        
      } else {
        res.status(200).json({ message: "seems like you are not a employee" });
      }
    }
  } catch (error) {
    res.status(400).send(error);
  }
});

// Change Password functionality
router.put("/changePassword", async (req, res) => {
  try{
    let data = await (await User.findOne({ email: req.body.email }));
    
    let salt = await bcrypt.genSalt(8);
    if (data) {
      let tempData = {data};
      tempData.data.randomString = salt;
      
      data.set(tempData.data);
      await data.save();
      
      let resetURL = process.env.baseURL + '/employee/passwordreset';
      resetURL = resetURL+"?id="+data._id+"&rs="+salt
          try {
            const sendMail = require('../services/mailService');
            
            sendMail({
              from: process.env.EMAIL,
              to: req.body.email,
              subject: 'CRM Reset Password',
              text: `${resetURL}`,
              html: `${resetURL}`,
            })
            .then(() => {
              return res.json({success: true});
            })
            .catch(err => {
              console.log("sukriti sneding email:" + err);
              return res.status(500).json({error: 'Error in email sending.'});
            });
        } 
        catch(err) {
          return res.status(500).send({ error: 'Something went wrong.'});
        }
      }
      else {
        res.status(400).json({
          message: "User is not registered"
        });
      }
  }
  catch(error){
    console.log("error is:" + error);
    res.status(500).json({
        message: "Internal Server Error"
    })
}
});

// Update Password functionality
router.post("/verifyPasswordChange", async (req, res) => {
  try {
    
    let data = await User.findOne({ _id: objectId(req.body.objectId) });
    if (data.randomString === req.body.randomString) {
      res.status(200).json({ message: "Verification success" });
    } 
    else {
      res.status(401).json({
        message: "You are not authorized",
      });
    }
  } 
  catch (error) {
    console.log("error is: " + error);
    res.status(500).json({
        message: "Internal Server Error"
    });
  }    
});

// updateDBWithPassword
router.put("/updatePassword", async (req, res) => {
  try{
    let salt = await bcrypt.genSalt(10); 
    
    let hash = await bcrypt.hash(req.body.password, salt);
    req.body.password = hash;
    let data = await User.findOne({ _id: objectId(req.body.objectId) });
    
    data.password = hash;
    
    await data.save();
    data1 = await User.findOne({ _id: objectId(req.body.objectId) });
    
    res.status(200).json({
        message : "Password Changed Successfully"
    })
  }
  catch(error){
    res.status(500).json({
        message: "Error while changing the password"
    })
  }
});

module.exports = router;
