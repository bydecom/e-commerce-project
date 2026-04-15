import { Router } from 'express';
import * as locationController from './location.controller';

export const locationRouter = Router();

locationRouter.get('/provinces',              locationController.getProvinces);
locationRouter.get('/districts/:provinceId',  locationController.getDistricts);
locationRouter.get('/wards/:districtId',      locationController.getWards);
