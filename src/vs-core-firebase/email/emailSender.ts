const admin = require('firebase-admin');

// import * as Config from '../config';

export type EmailMessage = {
  subject: string;
  html: string;
  text: string;
};

export type EmailTemplate = {
  name: string;
  data: any;
};

// {
//   name: ‘WelcomeMail’,
//   data: {
//    username: ‘William Beh’
//   }
//  }

export type EmailData = {
  to: string;
  from: string;
  bcc: string;
  message: EmailMessage;
  template: EmailTemplate;
};

export class EmailSender {
  // static defaultProps: LoggerConfigProps = {
  //   debug: false,
  //   info: true,
  // };

  static send(data: EmailData) {
    admin.firestore().collection('mail').add(data);
  }
}
