import PDFDocument from "pdfkit";
import {cloudinary} from "../config/cloudinary.js";
import { Readable } from "stream";

/**
 * Generate Donation Receipt PDF
 *
 * @param {Object} donation - Donation document
 * @returns {Promise<string>} - Cloudinary URL of uploaded PDF
 */
export const generateReceipt = async (donation) => {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      // Collect PDF chunks
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", async () => {
        try {
          // Upload to Cloudinary
          const buffer = Buffer.concat(chunks);
          const stream = Readable.from(buffer);

          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "foundation/receipts",
              resource_type: "raw",
              format: "pdf",
              public_id: `receipt-${donation.transactionId}`,
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result.secure_url);
            }
          );

          stream.pipe(uploadStream);
        } catch (error) {
          reject(error);
        }
      });

      // ─── PDF Content ─────────────────────────────────────────────────────────

      // Header
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("Donation Receipt", { align: "center" })
        .moveDown(0.5);

      doc
        .fontSize(12)
        .font("Helvetica")
        .text("Foundation Management Platform", { align: "center" })
        .moveDown(2);

      // Horizontal line
      doc
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(1.5);

      // Transaction Details
      doc.fontSize(14).font("Helvetica-Bold").text("Transaction Details");
      doc.moveDown(0.5);

      const leftColumn = 100;
      const rightColumn = 300;
      let yPosition = doc.y;

      const addRow = (label, value) => {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(label, leftColumn, yPosition);
        doc
          .fontSize(11)
          .font("Helvetica")
          .text(value, rightColumn, yPosition);
        yPosition += 25;
      };

      addRow("Transaction ID:", donation.transactionId);
      addRow("Date:", new Date(donation.approvedAt).toLocaleDateString());
      addRow(
        "Amount:",
        `${donation.amount.toLocaleString()} BDT`
      );
      addRow("Payment Method:", donation.paymentMethod.toUpperCase());
      if (donation.paymentReference) {
        addRow("Payment Ref:", donation.paymentReference);
      }
      addRow("Donation Type:", donation.donationType.replace("-", " ").toUpperCase());

      doc.y = yPosition + 10;
      doc
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(1.5);

      // Donor Information
      doc.fontSize(14).font("Helvetica-Bold").text("Donor Information");
      doc.moveDown(0.5);

      yPosition = doc.y;

      if (donation.isAnonymous) {
        addRow("Donor Name:", "Anonymous");
      } else if (donation.donor) {
        // Registered user
        addRow("Donor Name:", donation.donor.name || "N/A");
        addRow("Email:", donation.donor.email || "N/A");
      } else {
        // Guest donor
        addRow("Donor Name:", donation.guestDonorInfo.name || "N/A");
        addRow("Email:", donation.guestDonorInfo.email || "N/A");
        if (donation.guestDonorInfo.phone) {
          addRow("Phone:", donation.guestDonorInfo.phone);
        }
      }

      doc.y = yPosition + 10;

      // Campaign (if any)
      if (donation.campaign) {
        doc
          .strokeColor("#aaaaaa")
          .lineWidth(1)
          .moveTo(50, doc.y)
          .lineTo(550, doc.y)
          .stroke()
          .moveDown(1.5);

        doc.fontSize(14).font("Helvetica-Bold").text("Campaign");
        doc.moveDown(0.5);
        doc
          .fontSize(11)
          .font("Helvetica")
          .text(donation.campaign.title || "General Fund", {
            width: 450,
          });
        doc.moveDown(1);
      }

      // Message (if any)
      if (donation.message) {
        doc
          .strokeColor("#aaaaaa")
          .lineWidth(1)
          .moveTo(50, doc.y)
          .lineTo(550, doc.y)
          .stroke()
          .moveDown(1.5);

        doc.fontSize(14).font("Helvetica-Bold").text("Donor Message");
        doc.moveDown(0.5);
        doc
          .fontSize(10)
          .font("Helvetica-Oblique")
          .text(`"${donation.message}"`, { width: 450, align: "justify" });
        doc.moveDown(1);
      }

      // Footer
      doc.moveDown(3);
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          "Thank you for your generous contribution!",
          { align: "center" }
        );
      doc.moveDown(0.5);
      doc
        .fontSize(9)
        .fillColor("#666666")
        .text(
          "This is a computer-generated receipt and does not require a signature.",
          { align: "center" }
        );

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
