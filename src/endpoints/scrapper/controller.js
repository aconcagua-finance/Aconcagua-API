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

    LoggerHelper.info(`Starting scraping process for URL: ${scrappUrl}`);

    // Creating a new tab on browser
    const page = await browser.newPage();

    // Set a longer timeout for navigation (60 seconds)
    page.setDefaultNavigationTimeout(60000);

    // Set user agent to mimic a real browser
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );

    // Set viewport to a common resolution
    await page.setViewport({ width: 1280, height: 800 });

    // Enable request interception to block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      // Block images, fonts, and other non-essential resources
      if (['image', 'font', 'media', 'websocket'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    LoggerHelper.info(`Navigating to ${scrappUrl}`);

    // Access to page requested with timeout and wait until network is idle
    await page.goto(scrappUrl, {
      waitUntil: 'domcontentloaded', // Don't wait for all resources to load
      timeout: 60000,
    });

    LoggerHelper.info('Page loaded, evaluating content');

    // Evaluating the page and got informations from there
    let valuaciones = await page.evaluate(function () {
      // eslint-disable-next-line no-undef
      const mainQueryResult = document.querySelectorAll('.title');

      LoggerHelper.info(`Found ${mainQueryResult.length} title elements`);

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

    // Close the page to free resources
    await page.close();

    // me saco los vacios
    valuaciones = valuaciones.filter((item) => {
      return item.title;
    });

    LoggerHelper.info(`Valuaciones encontradas: ${JSON.stringify(valuaciones)}`);

    if (valuaciones.length === 0) {
      throw new Error('No se encontraron valuaciones en la página');
    }

    const DOLAR_HOY_DOLAR_CRIPTO_DOM_QUERY = process.env.DOLAR_HOY_DOLAR_CRIPTO_DOM_QUERY;

    const dolarCryptoCompra = valuaciones.find((valuation) => {
      return (
        valuation.title.toLowerCase().replace('ó', 'o') ===
        DOLAR_HOY_DOLAR_CRIPTO_DOM_QUERY.toLowerCase().replace('ó', 'o')
      );
    });

    if (!dolarCryptoCompra) {
      throw new Error(
        `No se encontró el dolar crypto con query: ${DOLAR_HOY_DOLAR_CRIPTO_DOM_QUERY}`
      );
    }

    LoggerHelper.info(`Dolar crypto encontrado: ${JSON.stringify(dolarCryptoCompra)}`);
    return res.status(200).send(dolarCryptoCompra);
  } catch (err) {
    // enviar mail
    const notifyAdmin = true;
    LoggerHelper.error(`Error en scrapper: ${err.message}`);
    return ErrorHelper.handleError(req, res, err, notifyAdmin);
  }
};
