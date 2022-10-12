/* eslint-disable no-unused-vars */
const admin = require('firebase-admin');

const Fuse = require('fuse.js');

const { creationStruct, updateStruct } = require('../../vs-core-firebase/audit');
const { ErrorHelper } = require('../../vs-core-firebase');
const { LoggerHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { Auth } = require('../../vs-core-firebase');

const { CustomError } = require('../../vs-core');

const { Collections } = require('../../types/collectionsTypes');
const { areEqualStringLists, areDeepEqualDocuments } = require('../../helpers/coreHelper');

const schemas = require('./schemas');

const { createClient } = require('@typeform/api-client');

const {
  MULTIPLE_RELATIONSHIP_SUFFIX,
  sanitizeData,
  find,
  findWithUserRelationship,
  get,
  patch,
  remove,
  create,
  createInner,
  fetchSingleItem,
  fetchItems,
  updateSingleItem,
  filterItems,
  fetchItemsByIds,
  getWithUserRelationshipById,
  listByProp,
  getByProp,
  listByPropInner,
  getFirebaseUserById,
} = require('../baseEndpoint');

const INDEXED_FILTERS = ['companyId', 'state', 'surveyStatus'];

const COMPANY_ENTITY_PROPERTY_NAME = 'companyId';
const COLLECTION_NAME = Collections.COMPANY_SURVEYS;

// used by ADMIN / PRACTITIONER
exports.findByCompany = async function (req, res) {
  const { companyId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
      primaryEntityValue: companyId,
      primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,

      postProcessor: async (items) => {
        const allItems = items.items.map((item) => {
          if (item.endDate) item.endDate = item.endDate.toDate();

          return item;
        });

        items.items = allItems;

        return items;
      },
    });
    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findByUserPendingSurveys = async function (req, res) {
  const { userId: targetUserId } = req.params;

  try {
    const firebaseUser = await getFirebaseUserById(targetUserId);

    const pendingSurveys = [];

    if (!firebaseUser.enterpriseRols || !firebaseUser.enterpriseRols.length) {
      return res.send({
        items: pendingSurveys,
        hasMore: false,
        total: pendingSurveys.length,
        pageSize: 100,
      });
    }

    const db = admin.firestore();

    // companySurveys
    console.log('Query (' + COLLECTION_NAME + ') by user pendings:');
    const companySurveysRef = db.collection(COLLECTION_NAME);
    let companySurveysQuerySnapshot = companySurveysRef.limit(100);
    companySurveysQuerySnapshot = await companySurveysQuerySnapshot
      .where('state', '==', Types.StateTypes.STATE_ACTIVE)
      .where('surveyStatus', '==', 'active')
      .where(
        'companyId',
        'in',
        firebaseUser.enterpriseRols.map((enterpriseRol) => {
          return enterpriseRol.companyId;
        })
      )
      .get();

    let companyActiveSurveys = [];

    if (companySurveysQuerySnapshot.docs) {
      const items = companySurveysQuerySnapshot.docs.map((doc) => {
        const id = doc.id;
        const data = doc.data();

        if (data.createdAt) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt) data.updatedAt = data.updatedAt.toDate();

        return { ...data, id };
      });

      items.sort((aa, bb) => {
        return bb.createdAt - aa.createdAt;
      });

      companyActiveSurveys = items;
    }

    console.log('companyActiveSurveys: ', JSON.stringify(companyActiveSurveys));

    // userSurveysResults
    console.log('Query (' + Collections.USER_SURVEYS_RESULTS + ') by user pendings:');
    const userSurveysResultsRef = db.collection(Collections.USER_SURVEYS_RESULTS);
    let userSurveysResultsQuerySnapshot = userSurveysResultsRef.limit(100);
    userSurveysResultsQuerySnapshot = await userSurveysResultsQuerySnapshot
      // .where('state', '==', Types.StateTypes.STATE_ACTIVE) // no tiene activo o no
      .where('userId', '==', targetUserId) // filtro por el usuario que se esta consultando
      .where(
        'surveyId',
        'in',
        companyActiveSurveys.map((companySurvey) => {
          return companySurvey.id;
        })
      )
      .get();

    let userSurveysResults = [];
    if (userSurveysResultsQuerySnapshot.docs) {
      const items = userSurveysResultsQuerySnapshot.docs.map((doc) => {
        const id = doc.id;
        const data = doc.data();

        if (data.createdAt) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt) data.updatedAt = data.updatedAt.toDate();

        return { ...data, id };
      });

      items.sort((aa, bb) => {
        return bb.createdAt - aa.createdAt;
      });

      userSurveysResults = items;
    }

    console.log('userSurveysResults: ', JSON.stringify(userSurveysResults));

    // si existe alguna survey activa que aún no fué respondida por el cliente, la agrego a la lista de pending
    companyActiveSurveys.forEach((companySurvey) => {
      const userSurveyResult = userSurveysResults.find((usr) => {
        return usr.surveyId === companySurvey.id;
      });

      if (!userSurveyResult) pendingSurveys.push(companySurvey);
    });

    const result = {
      items: pendingSurveys,
      hasMore: false,
      total: pendingSurveys.length,
      pageSize: 100,
    };

    console.log('findByUserPendingSurveys: ', JSON.stringify(result));
    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.get = async function (req, res) {
  const { id } = req.params;

  await getByProp({
    req,
    res,

    byId: id,

    primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
    primaryEntityCollectionName: Collections.COMPANIES,
    collectionName: COLLECTION_NAME,

    postProcessor: async (item) => {
      if (item.endDate) item.endDate = item.endDate.toDate();

      return item;
    },
  });
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  await patch(req, res, auditUid, COLLECTION_NAME, schemas.update);
};

exports.remove = async function (req, res) {
  await remove(req, res, COLLECTION_NAME);
};

exports.create = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  const body = req.body;
  body.companyId = req.params.companyId;

  await createInner({
    req,
    res,
    body,
    auditUid,
    collectionName: COLLECTION_NAME,
    validationSchema: schemas.create,
  });
};

const processUserSurveyOutcomes = async function ({
  answersWithQuestions,
  auditUid,

  userId,
  companyId,
  surveyId,
  answeredBy,
}) {
  console.log(
    'Upsert (' + Collections.USER_SURVEYS_OUTCOMES + ')',
    JSON.stringify(answersWithQuestions)
  );

  const db = admin.firestore();

  const aspectsWithScore = [];

  answersWithQuestions.forEach((answerWithQuestion) => {
    const maxValue = answerWithQuestion.question.optionsLen;

    answerWithQuestion.question.relatedAspects.forEach((aspectWithWeight) => {
      const aspectId = aspectWithWeight.aspectId;
      const weight = aspectWithWeight.weight;

      const answerResponseValue = answerWithQuestion.answerResponse; // puntuacion del usuario

      const puntuacionPonderada = answerResponseValue * weight; // puntuacion ponderada
      const valorMaxPorPeso = weight * maxValue;

      const score = puntuacionPonderada / valorMaxPorPeso;

      console.log(
        `aspectId: ${aspectId} - weight: ${weight} - answerResponseValue: ${answerResponseValue} - puntuacionPonderada: ${puntuacionPonderada} - valorMaxPorPeso: ${valorMaxPorPeso} - score: ${score}`
      );

      const aspectWithScore = aspectsWithScore.find((aws) => {
        return aws.aspectId === aspectId;
      });

      if (aspectWithScore) aspectWithScore.score += score;
      else aspectsWithScore.push({ score, aspectId });
    });
  });

  console.log('ASPECTSWITHSCORE !:', JSON.stringify(aspectsWithScore));
  // Get a new write batch
  const batch = db.batch();
  aspectsWithScore.forEach((aspectWithScore) => {
    const ref = db.collection(Collections.USER_SURVEYS_OUTCOMES).doc();

    batch.set(ref, {
      userId,
      companyId,
      surveyId,
      answeredBy,

      aspectId: aspectWithScore.aspectId,
      score: aspectWithScore.score,

      ...creationStruct(auditUid),
      ...updateStruct(auditUid),
    });
  });

  await batch.commit();

  return aspectsWithScore;
};

// TODO MICHEL esto va en otro endpoint y deberia evaluar todos los inputs para wellness
// por ahora un solo aspecto para wellness, el test...
const processUserWellness = async function ({
  aspectsWithScore,
  auditUid,

  userId,
}) {
  console.log(
    'Upsert (' + Collections.USER_WELL_BEING_ATTRIBUTES + ')',
    JSON.stringify(aspectsWithScore)
  );

  const db = admin.firestore();

  const userWellBeingAttributesRef = db.collection(Collections.USER_WELL_BEING_ATTRIBUTES);
  let userWellBeingAttributesQuerySnapshot = userWellBeingAttributesRef;
  userWellBeingAttributesQuerySnapshot = await userWellBeingAttributesQuerySnapshot
    .where('userId', '==', userId)
    .get();

  let userWellBeingAttributes = [];
  if (userWellBeingAttributesQuerySnapshot.docs) {
    const items = userWellBeingAttributesQuerySnapshot.docs.map((doc) => {
      const id = doc.id;
      const data = doc.data();

      if (data.createdAt) data.createdAt = data.createdAt.toDate();
      if (data.updatedAt) data.updatedAt = data.updatedAt.toDate();

      return { ...data, id };
    });

    items.sort((aa, bb) => {
      return bb.createdAt - aa.createdAt;
    });

    userWellBeingAttributes = items;
  }

  // Get a new write batch
  const batch = db.batch();
  aspectsWithScore.forEach((aspectWithScore) => {
    const userWellBeingAttribute = userWellBeingAttributes.find((wba) => {
      return wba.aspectId === aspectWithScore.aspectId;
    });

    if (userWellBeingAttribute) {
      // update
      const ref = db
        .collection(Collections.USER_WELL_BEING_ATTRIBUTES)
        .doc(userWellBeingAttribute.id);
      batch.set(ref, {
        userId,

        aspectId: aspectWithScore.aspectId,
        score: aspectWithScore.score,

        state: Types.StateTypes.STATE_ACTIVE,
        ...updateStruct(auditUid),
      });
    } else {
      // create
      const ref = db.collection(Collections.USER_WELL_BEING_ATTRIBUTES).doc();
      batch.set(ref, {
        userId,

        aspectId: aspectWithScore.aspectId,
        score: aspectWithScore.score,

        state: Types.StateTypes.STATE_ACTIVE,
        ...creationStruct(auditUid),
        ...updateStruct(auditUid),
      });
    }
  });

  await batch.commit();
};
