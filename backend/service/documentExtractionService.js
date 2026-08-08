const pdfExtract = require('pdf-extraction');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');

const extractTextFromPDF = async (fileBuffer) => {
    try {
        // Using pdf-extraction, which provides a stable, modern API
        // It completely avoids the previous CommonJS/ESM export bugs
        const data = await pdfExtract(fileBuffer);
        
        // Return the successfully extracted plain text
        return data.text;
    } catch (error) {
        console.error("Error parsing PDF file:", error);
        throw new Error("Unable to extract text from this PDF document.");
    }
};

const extractTextFromImage = async (fileBuffer) => {
    try {
        // Run OCR with English + Vietnamese language packs
        const { data } = await Tesseract.recognize(fileBuffer, 'eng+vie');
        return data.text;
    } catch (error) {
        console.error("Error running OCR on image file:", error);
        throw new Error("Unable to extract text from this image.");
    }
};

const extractTextFromDocx = async (fileBuffer) => {
    try {
        // mammoth reads the raw text content of a .docx file
        const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
        return value;
    } catch (error) {
        console.error("Error parsing DOCX file:", error);
        throw new Error("Unable to extract text from this Word document.");
    }
};

module.exports = {
    extractTextFromPDF,
    extractTextFromImage,
    extractTextFromDocx
};