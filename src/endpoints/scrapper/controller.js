/* eslint-disable no-unused-vars */
const admin = require('firebase-admin');

const { creationStruct, updateStruct } = require('../../vs-core-firebase/audit');
const { ErrorHelper } = require('../../vs-core-firebase');
const { LoggerHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { Auth } = require('../../vs-core-firebase');

const { CustomError } = require('../../vs-core');

const { Collections } = require('../../types/collectionsTypes');

const { DOLAR_HOY_DOLAR_CRIPTO_DOM_QUERY } = require('../../config/appConfig');

exports.scrappDolarHoyDolarCripto = async function (req, res) {
  try {
    const { userId } = res.locals; // user id

    const browser = res.locals.browser;

    const scrappUrl = 'https://dolarhoy.com/';

    /**
     * Creating a new tab on browser
     */
    const page = await browser.newPage();
    /**
     * Access to page requested
     */
    await page.goto(scrappUrl);

    /**
     * Evaluating the page and got informations from there
     */
    let valuaciones = await page.evaluate(function () {
      // eslint-disable-next-line no-undef
      const mainQueryResult = document.querySelectorAll('.tile .is-child');

      // return mainQueryResult[0].querySelectorAll('.title')[0].innerHTML;
      return Array.from(mainQueryResult).map((item) => {
        // medio raro, como que no funciona la sub seleccion pero logra el objetivo
        const titles = item.querySelectorAll('.title');
        const buys = item.querySelectorAll('.compra .val');
        const sells = item.querySelectorAll('.venta .val');
        let title = '';
        let buy = '';
        let sell = '';
        if (titles && titles.length && buys && buys.length && sells && sells.length) {
          title = titles[0].innerHTML;
          buy = parseFloat(buys[0].innerHTML.replace('$', ''));
          sell = parseFloat(sells[0].innerHTML.replace('$', ''));
        }

        return { title, buy, sell };
      });
    });

    // me saco los vacios
    valuaciones = valuaciones.filter((item) => {
      return item.title;
    });

    console.log('Valuaciones encontradas: ' + JSON.stringify(valuaciones));

    const DOLAR_HOY_DOLAR_CRIPTO_DOM_QUERY = process.env.DOLAR_HOY_DOLAR_CRIPTO_DOM_QUERY;

    const dolarCryptoCompra = valuaciones.find((valuation) => {
      return (
        valuation.title.toLowerCase().replace('ó', 'o') ===
        DOLAR_HOY_DOLAR_CRIPTO_DOM_QUERY.toLowerCase().replace('ó', 'o')
      );
    });

    if (!dolarCryptoCompra) throw new Error('No se encontró el dolar crypto');

    return res.status(200).send(dolarCryptoCompra);
  } catch (err) {
    // enviar mail
    const notifyAdmin = true;
    return ErrorHelper.handleError(req, res, err, notifyAdmin);
  }
};
