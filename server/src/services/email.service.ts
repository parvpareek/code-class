import * as brevo from '@getbrevo/brevo';
import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';

// Brevo configuration (v3 API)
const brevoApiInstance = new brevo.TransactionalEmailsApi();
if (process.env.BREVO_API_KEY) {
    brevoApiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
}

// Nodemailer configuration (Gmail backup)
const gmailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
    },
});

interface Recipient {
  email: string;
  name?: string;
}

const getRecipients = async (classId: string): Promise<Recipient[]> => {
    try {
        const classWithStudents = await prisma.class.findUnique({
            where: { id: classId },
            include: {
                students: {
                    select: {
                        user: {
                            select: {
                                email: true,
                                name: true,
                            }
                        }
                    }
                }
            }
        });

        if (!classWithStudents) {
            console.log(`No class found with ID: ${classId}`);
            return [];
        }

        return classWithStudents.students.map(student => ({
            email: student.user.email!,
            name: student.user.name!,
        }));
    } catch (error) {
        console.error('Error fetching recipients:', error);
        return [];
    }
}

const sendEmailWithBrevo = async (recipients: Recipient[], subject: string, htmlContent: string): Promise<boolean> => {
    try {
        if (!process.env.BREVO_API_KEY) {
            console.log('BREVO_API_KEY not configured, skipping Brevo');
            return false;
        }

        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = htmlContent;
        sendSmtpEmail.sender = { name: 'CodeClass Platform', email: 'no-reply@codeclass.com' };
        sendSmtpEmail.to = recipients;

        const response = await brevoApiInstance.sendTransacEmail(sendSmtpEmail);
        console.log('✅ Email sent successfully via Brevo:', response);
        return true;
    } catch (error: unknown) {
        const err = error as { response?: { body?: { message?: string; code?: string } }; message?: string; body?: { message?: string; code?: string } };
        // Brevo v3 may use response.body or just body depending on error type
        const errorMessage = err.response?.body?.message || err.body?.message || err.message || 'Unknown error';
        const errorCode = err.response?.body?.code || err.body?.code;
        console.error('❌ Brevo email failed:', errorMessage);
        
        // Check if it's an account activation error
        if (errorCode === 'permission_denied' && errorMessage.includes('not yet activated')) {
            console.log('🔔 BREVO ACCOUNT NOT ACTIVATED: Contact contact@brevo.com to activate your account');
        }
        return false;
    }
};

const sendEmailWithGmail = async (recipients: Recipient[], subject: string, htmlContent: string): Promise<boolean> => {
    try {
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            console.log('Gmail credentials not configured, skipping Gmail');
            return false;
        }

        const recipientEmails = recipients.map(r => r.email).join(', ');
        
        const mailOptions = {
            from: `"CodeClass Platform" <${process.env.GMAIL_USER}>`,
            to: recipientEmails,
            subject: subject,
            html: htmlContent,
        };

        const info = await gmailTransporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully via Gmail:', info.messageId);
        return true;
    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('❌ Gmail email failed:', err.message);
        return false;
    }
};

const sendEmail = async (recipients: Recipient[], subject: string, htmlContent: string): Promise<void> => {
    if (recipients.length === 0) {
        console.log('No recipients to send email to');
        return;
    }

    console.log(`📧 Attempting to send email to ${recipients.length} recipients...`);
    
    // Try Brevo first
    const brevoSuccess = await sendEmailWithBrevo(recipients, subject, htmlContent);
    if (brevoSuccess) return;

    // If Brevo fails, try Gmail
    console.log('🔄 Trying Gmail as backup...');
    const gmailSuccess = await sendEmailWithGmail(recipients, subject, htmlContent);
    if (gmailSuccess) return;

    // If both fail, log for development
    console.log('📝 Email service unavailable - logging email content for development:');
    console.log(`Subject: ${subject}`);
    console.log(`Recipients: ${recipients.map(r => `${r.name} <${r.email}>`).join(', ')}`);
    console.log(`Content: ${htmlContent}`);
};

export const sendAnnouncementEmail = async (classId: string, announcementContent: string, teacherName: string): Promise<void> => {
    try {
        const recipients = await getRecipients(classId);
        
        const subject = 'New Announcement';
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2563eb;">New Announcement</h1>
                <p>Your teacher, <strong>${teacherName}</strong>, has posted a new announcement:</p>
                <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #2563eb;">
                    <p>${announcementContent}</p>
                </div>
                <div style="margin: 20px 0; text-align: center;">
                    <a href="https://code-class-eight.vercel.app/" 
                       style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        View on CodeClass Platform
                    </a>
                </div>
                <p style="color: #666; font-size: 12px;">
                    This email was sent from CodeClass Platform - 
                    <a href="https://code-class-eight.vercel.app/" style="color: #2563eb;">https://code-class-eight.vercel.app/</a>
                </p>
            </div>
        `;

        await sendEmail(recipients, subject, htmlContent);
    } catch (error) {
        console.error('Error in sendAnnouncementEmail:', error);
    }
};

export const sendAssignmentEmail = async (classId: string, assignmentTitle: string, teacherName: string): Promise<void> => {
    try {
        const recipients = await getRecipients(classId);
        
        const subject = 'New Assignment';
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2563eb;">New Assignment</h1>
                <p>Your teacher, <strong>${teacherName}</strong>, has posted a new assignment:</p>
                <h2 style="color: #2563eb; background-color: #f8fafc; padding: 10px; border-radius: 5px;">${assignmentTitle}</h2>
                <p>Please log in to the platform to view the details and submit your work.</p>
                <div style="margin: 20px 0; text-align: center;">
                    <a href="https://code-class-eight.vercel.app/" 
                       style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        Complete Assignment on CodeClass
                    </a>
                </div>
                <p style="color: #666; font-size: 12px;">
                    This email was sent from CodeClass Platform - 
                    <a href="https://code-class-eight.vercel.app/" style="color: #2563eb;">https://code-class-eight.vercel.app/</a>
                </p>
            </div>
        `;

        await sendEmail(recipients, subject, htmlContent);
    } catch (error) {
        console.error('Error in sendAssignmentEmail:', error);
    }
}; 