import * as express from 'express';
/////////////////////////////////////////
/////////////////////////////////////////
import validationMiddleware from '../middlewares/validation';
import authMiddleware from '../middlewares/auth';
/////////////////////////////////////////
import IController from '../interfaces/IController';
import IUser from '../interfaces/user/IUser';
import IRequestWithUser from '../interfaces/httpRequest/IRequestWithUser';
import IRequest from '../interfaces/request/IRequest';
import IConversation from '../interfaces/IConversation';
/////////////////////////////////////////
import requestModel from '../models/request/Request';
import conversationModel from '../models/request/Conversation';
/////////////////////////////////////////
import ChatDTO from '../dto/ChatDTO';
/////////////////////////////////////////
import SomethingWentWrongException from './../exceptions/SomethingWentWrongException';
import HttpException from './../exceptions/HttpException';

////////////////////////////////////////
import Response from '../modules/Response';
import { SendNotfication } from './../modules/SendNotification';
import clientModel from './../models/user/Client';
import IClient from './../interfaces/user/IClient';
import requestOfferModel from './../models/request/RequestOffer';
import IRequestOffer from './../interfaces/request/IRequestOffer';
import helperModel from './../models/user/Helper';
import IHelper from './../interfaces/user/IHelper';
class ChatController implements IController {
  public path: string;
  public router: express.IRouter;
  constructor() {
    this.path = '/Chat';
    this.router = express.Router();
    this.initializeRoutes();
  }
  private initializeRoutes() {
    this.router.post(
      `${this.path}/SendMessage`,
      authMiddleware,
      validationMiddleware(ChatDTO),
      this.addMessage
    );
    this.router.get(`${this.path}/GetMsgs`, authMiddleware, this.GetMsgs);
  }
  private GetMsgs = async (
    request: IRequestWithUser,
    response: express.Response,
    next: express.NextFunction
  ) => {
    await this.getActiveRequest(request.user)
      .then(async (req: IRequest) => {
        if (req) {
          await conversationModel
            .findById(req.conversation)
            .then((conversation: IConversation) => {
              if (conversation) {
                response.status(200).send(
                  new Response(undefined, {
                    messages: conversation.messages,
                  }).getData()
                );
              } else {
                next(new HttpException(404, 'User Has No Active Chat'));
              }
            });
        } else {
          next(new HttpException(404, 'User Has No Active Request'));
        }
      })
      .catch((err) => {
        next(new SomethingWentWrongException(err));
      });
  };

  private addMessage = async (
    request: IRequestWithUser,
    response: express.Response,
    next: express.NextFunction
  ) => {
    const message: ChatDTO = request.body;
    const newMessage = {
      message: message.message,
      date: new Date(),
      senderRole: request.user.role,
      senderID: request.user._id,
      senderName: request.user.firstName + ' ' + request.user.lastName,
    };
    await this.getActiveRequest(request.user)
      .then(async (req: IRequest) => {
        if (req) {
          await conversationModel
            .findById(req.conversation)
            .then((conversation: IConversation) => {
              if (conversation) {
                conversation.messages.push(newMessage);
                conversation
                  .save()
                  .then(async () => {
                    if (request.user.role == 'Helper') {
                      await clientModel
                        .findById(req.client)
                        .then(async (client: IClient) => {
                          await SendNotfication(
                            'New Message Recieved From Helper',
                            message.message,
                            { type: 'NEW_MESSAGE' },
                            client.expoToken
                          )
                            .then((value: boolean) => {
                              response
                                .status(200)
                                .send(
                                  new Response(
                                    'Message Sent Succesfully',
                                    undefined
                                  ).getData()
                                );
                            })
                            .catch((err) => {
                              next(new SomethingWentWrongException(err));
                            });
                        });
                    } else {
                      await requestOfferModel
                        .findById(req.acceptedState.acceptedOffer)
                        .then(async (requestOffer: IRequestOffer) => {
                          await helperModel
                            .findById(requestOffer.helperID)
                            .then(async (helper: IHelper) => {
                              await SendNotfication(
                                'New Message Recieved From Client',
                                message.message,
                                { type: 'NEW_MESSAGE' },
                                helper.expoToken
                              )
                                .then((value: boolean) => {
                                  response
                                    .status(200)
                                    .send(
                                      new Response(
                                        'Message Sent Succesfully',
                                        undefined
                                      ).getData()
                                    );
                                })
                                .catch((err) => {
                                  next(new SomethingWentWrongException(err));
                                });
                            })
                            .catch((err) => {
                              next(new SomethingWentWrongException(err));
                            });
                        })
                        .catch((err) => {
                          next(new SomethingWentWrongException(err));
                        });
                    }
                  })
                  .catch((err) => {
                    next(new SomethingWentWrongException(err));
                  });
              } else {
                next(new HttpException(404, 'User Has No Active Chat'));
              }
            });
        } else {
          next(new HttpException(404, 'User Has No Active Request'));
        }
      })
      .catch((err) => {
        next(new SomethingWentWrongException(err));
      });
  };

  private async getActiveRequest(user: IUser): Promise<IRequest> {
    return new Promise<IRequest>(async (resolve, reject) => {
      await requestModel
        .findById(
          user.activeRequest,
          '-createdAt -updatedAt -__v -supportTickets'
        )
        .then((Request: IRequest) => {
          resolve(Request);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
}
export default ChatController;
