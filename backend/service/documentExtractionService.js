const pdfExtract = require('pdf-extraction');

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

module.exports = {
    extractTextFromPDF
};