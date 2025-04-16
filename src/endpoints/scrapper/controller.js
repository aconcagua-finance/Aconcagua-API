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
      const mainQueryResult = document.querySelectorAll('.title');

      return Array.from(mainQueryResult).map((titleElement) => {
        // Get the parent container that holds both title and values
        const container = titleElement.closest('div[class*="tile"]') || titleElement.parentElement;

        // Get the title text
        const titleText = titleElement.textContent.trim();

        // Get the values container
        const valuesContainer = container.querySelector('.values');

        let buy = '';
        let sell = '';

        if (valuesContainer) {
          // Get buy value
          const buyElement = valuesContainer.querySelector('.compra .val');
          if (buyElement) {
            buy = parseFloat(buyElement.textContent.replace('$', '').trim());
          }

          // Get sell value
          const sellElement = valuesContainer.querySelector('.venta .val');
          if (sellElement) {
            sell = parseFloat(sellElement.textContent.replace('$', '').trim());
          }
        }

        return { title: titleText, buy, sell };
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
