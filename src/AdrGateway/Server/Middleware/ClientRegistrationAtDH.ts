import express, { NextFunction } from "express";
import winston from "winston";
import _ from "lodash";
import { inject, injectable } from "tsyringe";
import { DefaultConnector } from "../../../Common/Connectivity/Connector.generated";
import { Schema, validationResult, matchedData, checkSchema, query } from "express-validator";
import { NoneFoundError } from "../../../Common/Connectivity/Errors";

const bodySchema: Schema = {
    productKey: { isString: { errorMessage: "productKey must be a string" }, isLength: { options: { min: 5 }, errorMessage: "productKey must be at least length 5" } },
    dataholderBrandId: { isString: { errorMessage: "dataholderBrandId must be a string" }, isLength: { options: { min: 5 }, errorMessage: "dataholderBrandId must be at least length 5" } }
};

const querySchema: Schema = {
};

// NF: This handler performs an explicit Dynamic Client Registration request at data holder
// It will create or update the registration at the given dataholder and when succesfull 
// store a record in our ADR database - all this is abstracted in src/Common/Connectivity/DhNewClientRegistration
// including the gneration of the DCR JWT based on the Software Statement Assertion

@injectable()
class ClientRegistrationAtDHMiddleware {

    constructor(
        @inject("Logger") private logger: winston.Logger,
        private connector: DefaultConnector
    ) { }

    handler = () => {
        let validationErrorMiddleware = (req: express.Request, res: express.Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            next();
        }

        let Responder = async (req: express.Request, res: express.Response) => {

            let m = <any>matchedData(req);

            try {
                const response = await this.connector.DhNewClientRegistration(m.productKey, m.dataholderBrandId).GetWithHealing({ ignoreCache: "all" });
                return res.json(response);
            } catch (e) {
                if (e instanceof NoneFoundError) {
                    return res.status(404).send();
                }
                this.logger.error("Could not generate consent URL", e)
                return res.status(500).send();
            }
            // TODO do redirect instead of merely describing one
        };

        // decide whether to validate based on body or query parameters
        // TODO add client authorization
        return _.concat(
            [
                express.json()
            ],
            <any>checkSchema(bodySchema, ['body']),
            <any>checkSchema(querySchema, ['query']),
            [
                query(),
                validationErrorMiddleware,
                Responder
            ])
    }
}

export { ClientRegistrationAtDHMiddleware }