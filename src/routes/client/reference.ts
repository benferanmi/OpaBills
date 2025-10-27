import { Router } from 'express';
import { ReferenceDataController } from '@/controllers/client/ReferenceDataController';
import { ReferenceDataService } from '@/services/client/ReferenceDataService';

const router = Router();

const referenceDataService = new ReferenceDataService(
);

const referenceDataController = new ReferenceDataController(referenceDataService);

// Countries
router.get('/countries', referenceDataController.getAllCountries);
router.get('/countries/search', referenceDataController.searchCountries);
router.get('/countries/:id', referenceDataController.getCountryById);

// States
router.get('/countries/:countryId/states', referenceDataController.getStatesByCountry);
router.get('/states/:id', referenceDataController.getStateById);

// Cities
router.get('/states/:stateId/cities', referenceDataController.getCitiesByState);
router.get('/cities/:id', referenceDataController.getCityById);

// Providers
router.get('/providers', referenceDataController.getProviders);
router.get('/providers/:id', referenceDataController.getProviderById);

// Services
router.get('/services', referenceDataController.getServices);
router.get('/services/:id', referenceDataController.getServiceById);

// Products
router.get('/products', referenceDataController.getProducts);
router.get('/products/search', referenceDataController.searchProducts);
router.get('/products/:id', referenceDataController.getProductById);

// Banks
router.get('/banks', referenceDataController.getBanks);

export default router;
