import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
// import { AuthGuard } from 'src/auth/auth.guard';
import { CopyPayload } from 'src/interfaces/copy-payload.interface';
import { Request } from 'src/types/request';
import { CopyService } from './copy.service';

// @UseGuards(AuthGuard)
@Controller('copy')
export class CopyController {
  constructor(private copyService: CopyService) {}

  @Post('/')
  async addToQueue(
    @Body('leadIds') leadIds: number[],
    @Body('payload') payload: CopyPayload,
    @Req() req: Request,
  ) {
    const requestId = await this.copyService.addToQueue(
      leadIds,
      payload,
      req.params.account,
    );

    return { requestId };
  }

  @Get('/check')
  check(@Query('requestId') requestId: string) {
    return this.copyService.check(requestId);
  }

  @Post('/dp')
  async dp(
    @Body()
    body: {
      event: { type: string; data: { id: string } };
      action: { code: string; settings: { widget: any; widget_info: any } };
      account_id: string;
    },
    @Req() req: Request,
  ) {
    const leadId = Number(body.event.data.id);
    const payload = JSON.parse(body.action.settings.widget.settings.config);
    return this.copyService.addToQueue([leadId], payload, req.params.account);
  }
}
