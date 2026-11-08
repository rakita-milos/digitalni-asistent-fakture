/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { APP_NAME } from '@digitalni-asistent/shared';

import App from '../App';

test('renderuje se i prikazuje ime proizvoda iz shared paketa', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const rendered = JSON.stringify(tree?.toJSON());
  expect(rendered).toContain(APP_NAME);
});
