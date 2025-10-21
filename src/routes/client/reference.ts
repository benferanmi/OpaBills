import { Router } from 'express';
import { ReferenceDataController } from '@/controllers/client/ReferenceDataController';
import { ReferenceDataService } from '@/services/ReferenceDataService';
import { CountryRepository } from '@/repositories/CountryRepository';
import { StateRepository } from '@/repositories/StateRepository';
import { CityRepository } from '@/repositories/CityRepository';
import { ProviderRepository } from '@/repositories/ProviderRepository';
import { ServiceRepository } from '@/repositories/ServiceRepository';
import { ProductRepository } from '@/repositories/ProductRepository';
import { BankAccountRepository } from '@/repositories/BankAccountRepository';

const router = Router();

// Initialize dependencies
const countryRepository = new CountryRepository();
const stateRepository = new StateRepository();
const cityRepository = new CityRepository();
const providerRepository = new ProviderRepository();
const serviceRepository = new ServiceRepository();
const productRepository = new ProductRepository();
const bankAccountRepository = new BankAccountRepository();

const referenceDataService = new ReferenceDataService(
  countryRepository,
  stateRepository,
  cityRepository,
  providerRepository,
  serviceRepository,
  productRepository,
  bankAccountRepository
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
