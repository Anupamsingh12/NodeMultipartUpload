const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = 3000;
app.use(cors()); 
app.use(express.json());
// Set up multer to handle file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configure AWS SDK with your S3 credentials
const s3 = new AWS.S3({
    accessKeyId: "ACCESS_KEY",
    secretAccessKey: "SECRET_KEY",
    region: "REGION"
});

function generateRandomNumberString(name) {
    let ext  = name.split('.');
    ext = ext[ext.length-1]
    // Generate a random number between 0 and 9999
    const randomNumber = Math.floor(Math.random() * 10000);
  
    // Get the current timestamp in milliseconds
    const timestamp = new Date().getTime();
  
    // Concatenate the random number and timestamp
    const result = `${randomNumber}${timestamp}.${ext}`;
  
    return result;
  }

app.post('/generateUploadId', async (req, res) => {
    console.log(req.body)
    const { fileName } = req.body;
    const randomName = generateRandomNumberString(fileName);
    try {
      const createMultipartUploadResponse = await s3.createMultipartUpload({
        Bucket: 'YOUR_BUCKET_NAME',
        Key: randomName,
      }).promise();
  
      res.status(200).json({
        uploadId: createMultipartUploadResponse.UploadId,
        key:randomName
      });
    } catch (error) {
      console.error('Error generating upload ID:', error);
      res.status(500).json({
        error: 'Internal Server Error',
      });
    }
  });

// Define a route to handle the chunk uploads
app.post('/uploadChunk', upload.single('fileChunk'), async (req, res) => {
    const { originalname, buffer, fieldname } = req.file;
    const { fileName, chunkIndex, uploadId,key } = req.body;
  
    const uploadParams = {
      Bucket: 'YOUR_BUCKET_NAME',
      Key: key,
      Body: buffer,
      PartNumber: chunkIndex,
      UploadId: uploadId,
    };
  
    try {
      const data = await s3.uploadPart(uploadParams).promise();
  
      res.status(200).json({
        message: 'Chunk uploaded successfully',
        data,
      });
    } catch (error) {
      console.error('Error uploading chunk to S3:', error);
      await s3.abortMultipartUpload({
        Bucket: 'YOUR_BUCKET_NAME',
        Key: key,
        UploadId: uploadId,
      }).promise();
      res.status(500).json({
        error: 'Internal Server Error',
      });
    }
  });

// Define a route to complete the multipart upload on S3
app.post('/completeUpload', async (req, res) => {
    const { fileName, uploadId, totalChunks,key } = req.body;
  
    const listPartsParams = {
      Bucket: 'YOUR_BUCKET_NAME',
      Key: key,
      UploadId: uploadId,
    };
  
    try {
      const partsData = await s3.listParts(listPartsParams).promise();
      const parts = partsData.Parts;
  
      if (parts.length !== totalChunks) {
        throw new Error('Number of uploaded parts does not match totalChunks');
      }
  
      // Extract only necessary information from parts
      const formattedParts = parts.map(part => ({
        ETag: part.ETag,
        PartNumber: part.PartNumber,
      }));
  
      const completeParams = {
        Bucket: 'YOUR_BUCKET_NAME',
        Key: key,
        MultipartUpload: { Parts: formattedParts },
        UploadId: uploadId,
      };
  
      await s3.completeMultipartUpload(completeParams).promise();
  
      res.status(200).json({
        message: 'Multipart upload completed successfully',ley:fileName
      });
    } catch (error) {
      console.error('Error completing multipart upload on S3:', error);
      await s3.abortMultipartUpload({
        Bucket: 'YOUR_BUCKET_NAME',
        Key: key,
        UploadId: uploadId,
      }).promise();
      res.status(500).json({
        error: 'Internal Server Error',
      });
    }
  });
  
  

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
