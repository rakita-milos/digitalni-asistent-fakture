import {
  getReminderSettings,
  sendInvoiceReminder,
  updateReminderSettings,
} from './reminders';
import { apiRequest } from './client';

jest.mock('./client', () => ({
  apiRequest: jest.fn(),
}));

const apiRequestMock = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('reminders API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('učitava podešavanja podsjetnika', async () => {
    apiRequestMock.mockResolvedValue({ enabled: false, schedule: [] } as never);

    await getReminderSettings();

    expect(apiRequestMock).toHaveBeenCalledWith('/reminder-settings');
  });

  it('čuva podešavanja podsjetnika (PUT)', async () => {
    apiRequestMock.mockResolvedValue({ enabled: true } as never);

    const input = {
      enabled: true,
      schedule: [{ offsetDays: 3, kind: 'sms' }],
      template: { text: 'Račun {broj} — {iznos}' },
    };

    await updateReminderSettings(input);

    expect(apiRequestMock).toHaveBeenCalledWith('/reminder-settings', {
      method: 'PUT',
      body: input,
    });
  });

  it('šalje ručni podsjetnik za fakturu', async () => {
    apiRequestMock.mockResolvedValue({ id: 'reminder-1' } as never);

    await sendInvoiceReminder('invoice-1');

    expect(apiRequestMock).toHaveBeenCalledWith('/invoices/invoice-1/remind', {
      method: 'POST',
      body: {},
    });
  });
});
