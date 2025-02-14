import { Mutex } from 'async-mutex';
import * as express from 'express';
import { cloneDeep } from 'lodash';

import ProviderModel, { Provider } from '../models/provider';
import { providersMap } from '../shared/global';

const router = express.Router();
let requested = false;
const mutex = new Mutex();

router.post('/', (req, res, next) => {
  const provider = new ProviderModel(req.body.provider);
  mutex.acquire().then((release) => {
    provider
      .save()
      .then((savedProvider) => {
        if (requested) providersMap[savedProvider._id] = cloneDeep(savedProvider.toJSON());
        release();
        res.status(201).json({
          message: 'Fornecedor cadastrado!',
        });
      })
      .catch((err) => {
        release();
        res.status(500).json({
          message: 'Erro ao cadastrar fornecedor!',
          error: err,
        });
      });
  });
});

router.post('/update', async (req, res, next) => {
  try {
    const provider = await ProviderModel.findOneAndUpdate(
      { _id: req.body.provider._id, __v: req.body.provider.__v },
      req.body.provider,
      { upsert: false }
    );
    if (!provider) {
      return res.status(500).json({
        message: 'O documento foi atualizado por outro usuário. Por favor, recarregue os dados e tente novamente.',
      });
    }
    if (requested) {
      await mutex.runExclusive(async () => {
        providersMap[req.body.provider._id] = cloneDeep(provider.toJSON());
      });
    }
    return res.status(200).json({
      message: 'Fornecedor Atualizado!',
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao atualizar fornecedor!',
      error: err,
    });
  }
});

router.post('/all', async (req, res) => {
  if (!requested) {
    const providers: Provider[] = await ProviderModel.find({});
    providers.map((provider) => (providersMap[provider._id] = cloneDeep(provider)));
    requested = true;
  }
  return res.status(200).json(Array.from(Object.values(providersMap)));
});

export default router;
