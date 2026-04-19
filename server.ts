import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  // Email API Endpoint
  app.post("/api/send-payslip", async (req, res) => {
    if (!resend) {
      console.warn("RESEND_API_KEY not configured. Email NOT sent.");
      return res.status(200).json({ status: "skipped", message: "API Key not configured" });
    }

    const { email, employeeName, period, totalPay, deduction, grossPay, companyName } = req.body;

    try {
      const { data, error } = await resend.emails.send({
        from: "Payslip Notifier <onboarding@resend.dev>",
        to: [email],
        subject: `Payslip for Period ${period} - ${employeeName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
            <h1 style="color: #1e293b; font-size: 24px;">Your Payslip is Ready</h1>
            <p style="color: #64748b;">Hello <strong>${employeeName}</strong>,</p>
            <p style="color: #64748b;">Your payroll for the period <strong>${period}</strong> has been processed by <strong>${companyName}</strong>.</p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #64748b;">Gross Pay:</span>
                <span style="font-weight: bold; color: #1e293b;">₱${grossPay.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #64748b;">Deductions:</span>
                <span style="font-weight: bold; color: #ef4444;">- ₱${deduction.toFixed(2)}</span>
              </div>
              <div style="height: 1px; background-color: #e2e8f0; margin: 12px 0;"></div>
              <div style="display: flex; justify-content: space-between; font-size: 18px;">
                <span style="color: #1e293b; font-weight: bold;">Net Pay:</span>
                <span style="font-weight: bold; color: #2563eb;">₱${totalPay.toFixed(2)}</span>
              </div>
            </div>
            
            <p style="color: #94a3b8; font-size: 12px;">This is an automated notification. Please check your full payslip in the company portal for more details.</p>
          </div>
        `,
      });

      if (error) {
        return res.status(400).json({ status: "error", error });
      }

      res.status(200).json({ status: "ok", data });
    } catch (e) {
      res.status(500).json({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
