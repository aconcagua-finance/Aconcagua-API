import { getEnvVariable } from '../helpers/envGetter';

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
  static async send(data: EmailData) {
    try {
      // Obtener el valor de SEND_EMAIL usando la función que trae las variables de ambiente
      const sendEmailFlag = await getEnvVariable('SEND_EMAIL');

      // Si SEND_EMAIL es 'FALSE', no se envía el email
      if (sendEmailFlag && sendEmailFlag.toUpperCase() === 'FALSE') {
        console.log('El envío de correos está deshabilitado. No se enviará el correo.');
        return; // Termina la ejecución sin enviar el email
      }

      // Si SEND_EMAIL es 'TRUE' o no está definida, procede con el envío
      await admin.firestore().collection('mail').add(data);
      console.log('Correo enviado con éxito.');
    } catch (error) {
      console.error('Error al obtener la variable SEND_EMAIL o al enviar el correo:', error);
    }
  }
}
