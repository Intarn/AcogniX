const pdfExtract = require('pdf-extraction');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const AppError = require('../error/AppError');

const extractTextFromPDF = async (fileBuffer) => {
    try {
        const data = await pdfExtract(fileBuffer);
        return data.text;
    } catch (error) {
        console.error("Error parsing PDF file:", error);
        throw new AppError(422, 'DOCUMENT_EXTRACTION_FAILED', 'Unable to extract text from this PDF document.');
    }
};

const extractTextFromImage = async (fileBuffer) => {
    try {
        const { data } = await Tesseract.recognize(fileBuffer, 'eng+vie');
        return data.text;
    } catch (error) {
        console.error("Error running OCR on image file:", error);
        throw new AppError(422, 'DOCUMENT_EXTRACTION_FAILED', 'Unable to extract text from this image.');
    }
};

const extractTextFromDocx = async (fileBuffer) => {
    try {
        const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
        return value;
    } catch (error) {
        console.error("Error parsing DOCX file:", error);
        throw new AppError(422, 'DOCUMENT_EXTRACTION_FAILED', 'Unable to extract text from this Word document.');
    }
};

module.exports = {
    extractTextFromPDF,
    extractTextFromImage,
    extractTextFromDocx
};