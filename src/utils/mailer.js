import nodemailer from "nodemailer";

export const sendVerificationEmail = async ({ to, verificationLink }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  
  await transporter.sendMail({
    from: `"CareerOps" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Verify your email address",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f7;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f7;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
                
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                    <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">CareerOps</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #111827;">Verify your email address</h2>
                    <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #6b7280;">
                      Thanks for signing up for CareerOps! To complete your registration and start tracking your job applications, please verify your email address by clicking the button below.
                    </p>
                    
                    <!-- Button -->
                    <table role="presentation" style="margin: 32px 0;">
                      <tr>
                        <td style="border-radius: 6px; background-color: #111827;">
                          <a href="${verificationLink}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                            Verify Email Address
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 24px 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                      Or copy and paste this link into your browser:
                    </p>
                    <p style="margin: 8px 0 0; font-size: 14px; line-height: 20px; color: #3b82f6; word-break: break-all;">
                      ${verificationLink}
                    </p>
                    
                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0; font-size: 14px; line-height: 20px; color: #9ca3af;">
                        ⏱️ This link will expire in <strong style="color: #6b7280;">15 minutes</strong>.
                      </p>
                      <p style="margin: 16px 0 0; font-size: 14px; line-height: 20px; color: #9ca3af;">
                        If you didn't create an account with CareerOps, you can safely ignore this email.
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 32px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                    <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                      © ${new Date().getFullYear()} CareerOps. All rights reserved.
                    </p>
                    <p style="margin: 8px 0 0; font-size: 12px; line-height: 18px; color: #9ca3af; text-align: center;">
                      This is an automated message, please do not reply.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });
};