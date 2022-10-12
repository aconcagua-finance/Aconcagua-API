# API

_NOTES_

- These docs are still being written. In some cases there are several methods
  that exist that are not documented.

<!-- AUTO-GENERATED-CONTENT:START (TOC) -->

<!-- AUTO-GENERATED-CONTENT:END -->

<!-- AUTO-GENERATED-CONTENT:START (METHODS) -->

<!-- AUTO-GENERATED-CONTENT:END -->

(1) Cerremos fecha tentativa primero >> Fines de octubre
(2) Definir si les gustaría pasar 4/5 días en ARG y luego hacer 10 / 12 días en otro lado
(3) Buscar vuelos al destino (ARG / 'Otro lado'), dependiendo punto anterior
(4) Documentación o algo que necesiten ?

1: yo creo que bien.
2: por mi bien también, eso como tú quieras.
3: tenemos que hablarlo
4: nada que yo sepa

1. Ponemos un destino común, ejemplo colombia/brasil/mexico.

   > Pros: Ni por lejos se lo esperaría, estaríamos todos juntos en un lugar super lindo
   > Cons: Es muy complejo de coordinar, tampoco me gustaría la idea de que aterricen en un lugar que yo no conozco tanto. Me imaginaba en todos los casos yendo a buscarlas a dnd aterricen

2. Con viajamos nosotros (Zoe/Miche) a un lugar de Asia / Euro bastante alejado como para que zoe no se imagine que las vamos a ver

   > Pros: Uds tendrían muy poco tiempo de viaje / no deberían pedirse vacaciones
   > Cons: El efecto sorpresa no sería tanto porque seguro si pasamos por europa o cerca ella sabría que las vamos a ver

3. Viajan uds a BS AS, hacemos 4/5 días acá en donde manejamos los tiempos de trabajo como quisiéramos y luego vemos si podemos hacer unas 'vacaciones' a un lugar más lindo
   > Pros: Sorpresa mil%. Si buscamos vuelos de fin de semana solo deberíamos buscarle la vuelta a los días que estemos más de 'vacaciones' y pilotear el trabajo a distancia
   > Cons: Mucho tiempo de viaje de uds. Horario cruzado para trabajar.

Configure ZOHO

- Configure Lead / Products module fields
- Configure Automation >> Webhooks
- Go to https://api-console.zoho.com/, create self client
- Set scopes: ZohoCRM.coql.READ, ZohoCRM.modules.all
- Post with postman to https://accounts.zoho.com/oauth/v2/token?code=1000.1fde08a41a24a5999732ebec61bba2af.4e011f61232687b916407aa147dfe2f3&grant_type=authorization_code&client_id=1000.X55856VNMFJHBW3PVF05O36I1XYSYM&client_secret=c337f4f39ab38eb26c0d2f5e5ab80729e22bff6e6b&redirect_uri=https://tryaconcagua-qa.web.app/auth/zoho&response_type=code&access_type=offline

Configure Firebase

- Reset password template (with action link custom) (https://hiyoda.com/reset-confirm-password)
- Two sites

Batch
const commitsPromises = [];

let i;
let j;
let temparray;
const chunk = 200;
for (i = 0, j = crmProducts.length; i < j; i += chunk) {
temparray = crmProducts.slice(i, i + chunk);

    // Get a new write batch
    var batch = db.batch();
    temparray.forEach((crmProduct) => {
      const localProduct = localProducts.find((lp) => {
        return lp.id === crmProduct.id;
      });
      if (localProduct) {
        console.log('Local product exists');
        localDocResponse = await patchProduct({
          uid,
          itemId: id,
          code: crmProduct.code,
          friendlyName: crmProduct.friendlyName,
          description: crmProduct.description,

          category: crmProduct.category, // package / single
          type: crmProduct.type, // none / telemedicine / homeassistance / etc

          country: crmProduct.country,
          recomended: crmProduct.recomended,

          price: crmProduct.price,

          subProducts: crmProduct.subProducts,
          state: crmProduct.state,
        });

        retCode = 204;
      } else {
        console.log('Local product not exists');

        localDocResponse = await createProduct({
          uid,
          itemId: id,
          code: crmProduct.code,
          friendlyName: crmProduct.friendlyName,
          description: crmProduct.description,

          category: crmProduct.category, // package / single
          type: crmProduct.type, // none / telemedicine / homeassistance / etc

          country: crmProduct.country,
          recomended: crmProduct.recomended,

          price: crmProduct.price,

          subProducts: crmProduct.subProducts,
          state: Types.StateTypes.STATE_ACTIVE,
        });

        retCode = 201;
      }
      const ref = db.collection(MEDICS_COLLECTION_NAME).doc(medicToUpdate.id);
      batch.update(ref, updatedData);
    });

    commitsPromises.push(batch.commit());

TODO MICHEL

- Insertar en usersByStaff el id generado con el id del user y el id del staff para luego en las firestore rules poder queriar ese doc

ISSUES

- Al crear un usuario no se refresca la lista
