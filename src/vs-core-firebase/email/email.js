const nodemailer = require('nodemailer');

const fs = require('fs');

const { GMAIL_EMAIL, GMAIL_EMAIL_BCC, GMAIL_APP_PASSWORD } = process.env;

const sendEmail = async function (requestBody) {
  const { from, to, bcc, subject, html, text } = requestBody;

  const mailOptions = {
    from,
    to,
    bcc,
    subject,
    html,
    text,
  };

  const gmailEmail = GMAIL_EMAIL;
  const gmailPassword = GMAIL_APP_PASSWORD;
  const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailEmail,
      pass: gmailPassword,
    },
  });

  await mailTransport.sendMail(mailOptions);
};

exports.sendEmail = sendEmail;

exports.sendTemplateEmail = async function ({
  template,
  headerTitle,
  headerBody,
  contentTitle,
  contentBody,
  buttonText,
  buttonLink,
  emailTo,
  subject,
}) {
  try {
    let templatePath = 'email/emailTemplates/welcome.html';
    if (template) {
      switch (template) {
        case 'WELCOME':
          templatePath = 'email/emailTemplates/welcome.html';
          break;

        case 'INVITE':
          templatePath = 'email/emailTemplates/invitationWelcomeEmail.html';
          break;
        case 'DEFAULT':
          templatePath = 'email/emailTemplates/welcome.html';
          break;
      }
    }

    let html = fs.readFileSync(templatePath, {
      encoding: 'utf-8',
    });

    html = html.replace('%%HEADER_TITLE%%', headerTitle);
    html = html.replace('%%HEADER_BODY%%', headerBody);
    html = html.replace('%%CONTENT_TITLE%%', contentTitle);
    html = html.replace('%%CONTENT_BODY%%', contentBody);

    html = html.replace('%%BUTTON_TEXT%%', buttonText);
    html = html.replace('%%BUTTON_LINK%%', buttonLink);

    const mailResponse = await sendEmail({
      from: '"HiYoda" <' + GMAIL_EMAIL + '>',
      to: emailTo,
      bcc: GMAIL_EMAIL_BCC,
      subject,
      text: null,
      html,
    });

    // console.log("Mail OK:" + JSON.stringify(mailResponse));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Mail not sended:', e.message, e.code, e.response, e.responseCode, e.command);
  }
};
