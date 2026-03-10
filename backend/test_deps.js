require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const admin = require("firebase-admin");
const xlsx = require('xlsx');

const app = express();
app.listen(5050, () => {
    console.log('Listening on 5050');
});
