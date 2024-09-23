import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { RouterProvider } from 'react-router-dom';

import './i18n';
import { Authenticator } from '@aws-amplify/ui-react';
import { router } from './routes';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <Authenticator.Provider>
          <RouterProvider router={router} />
      </Authenticator.Provider>
  </React.StrictMode>
)