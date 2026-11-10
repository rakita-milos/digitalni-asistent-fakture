import type { SubscriptionDto } from './subscriptions';
import { getSubscription } from './subscriptions';
import { apiRequest } from './client';

jest.mock('./client', () => ({
  apiRequest: jest.fn(),
}));

const apiRequestMock = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('subscriptions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('učitava pretplatu firme', async () => {
    const response: { subscription: SubscriptionDto | null } = { subscription: null };
    apiRequestMock.mockResolvedValue(response as never);

    const result = await getSubscription();

    expect(apiRequestMock).toHaveBeenCalledWith('/subscriptions');
    expect(result.subscription).toBeNull();
  });
});
