import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { Account } from 'src/accounts/account.entity';
import { CopyPayload } from 'src/interfaces/copy-payload.interface';
import { AccountsService } from 'src/accounts/accounts.service';
import { CopyJob } from 'src/types/copy-job';
import * as uniqid from 'uniqid';

@Injectable()
export class CopyService {
  constructor(
    @InjectQueue('copy-queue')
    private copyQueue: Queue,
    private accountsService: AccountsService,
  ) {}

  private jobsMap: Record<string, CopyJob[]> = {};

  async addToQueue(leadsIds: number[], payload: CopyPayload, account: Account) {
    const requestId = uniqid();
    this.jobsMap[requestId] = await this.copyQueue.addBulk(
      leadsIds.map((leadId) => ({
        name: 'copy',
        data: { account, requestId, leadId, payload },
      })),
    );

    return requestId;
  }

  async check(requestId: string) {
    const jobs = this.jobsMap[requestId];

    let completed = 0;
    let failed = 0;
    const total = jobs.length;

    const results = await Promise.all(
      jobs.map(async (job) => {
        const state = await job.getState();
        if (state === 'failed') {
          failed++;
        } else if (state === 'completed') {
          completed++;
          return job.finished();
        }

        return null;
      }),
    );

    return {
      total,
      completed,
      failed,
      progress: ((completed + failed) / total) * 100,
      results: results.filter((i) => i),
    };
  }

  async copy(job: CopyJob) {
    try {
      const {
        data: { account, leadId, payload },
      } = job;

      const api = this.accountsService.createConnector(account.amoId);
      const { data: lead } = await api.get(`/api/v4/leads/${leadId}`, {
        params: {
          with: 'contacts',
        },
      });

      const [pipelineId, statusId] = payload.statusId.split('_');
      const body: any = {
        name: `Копия - ${lead.name}`,
        responsible_user_id: payload.responsibleId,
        pipeline_id: Number(pipelineId),
        status_id: Number(statusId),
        price: payload.budget ? lead.price : 0,
        custom_fields_values: (lead.custom_fields_values || [])
          .filter((cf) => payload.customFields.includes(cf.field_id))
          .map((cf) => ({
            field_id: cf.field_id,
            field_code: cf.field_code,
            values: cf.values.map(({ enum_id, value }) => {
              if (cf.field_type === 'smart_address') {
                return { enum_id, value };
              } else {
                return { value };
              }
            }),
          })),
        _embedded: {
          tags: lead._embedded.tags.map(({ id }) => ({ id })),
        },
      };

      if (payload.linkedEntites) {
        body._embedded.contacts = lead._embedded.contacts.map(({ id }) => ({
          id,
        }));

        body._embedded.companies = lead._embedded.companies.map(({ id }) => ({
          id,
        }));
      }

      await api.post('/api/v4/leads', [body]);
    } catch (e) {
      console.error(e.message);
    }
  }
}
