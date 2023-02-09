import { Module } from '@nestjs/common';
import { CopyService } from './copy.service';
import { CopyController } from './copy.controller';
import { BullModule } from '@nestjs/bull';
import { AccountsModule } from 'src/accounts/accounts.module';
import { CopyProcessor } from './copy.processor';

@Module({
  imports: [
    AccountsModule,
    BullModule.registerQueue({
      name: 'copy-queue',
      limiter: {
        max: 1,
        duration: 1000,
        groupKey: 'account.id',
      },
    }),
  ],
  providers: [CopyService, CopyProcessor],
  controllers: [CopyController],
})
export class CopyModule {}
