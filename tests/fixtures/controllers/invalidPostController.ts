import {
  Body, Post, Route,
} from '../../../src';
import { ModelService } from '../services/modelService';
import { TestModel } from '../testModel';

@Route('PostTest')
export class InvalidPostTestController {

  @Post('WithMultipleBody')
  public async postWithMultipleBodyParams(
    @Body() firstParam: TestModel,
    @Body() secondParam: TestModel): Promise<TestModel> {
    return new ModelService().getModel();
  }
}
