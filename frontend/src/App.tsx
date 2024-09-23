import React, { useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { signInWithRedirect } from 'aws-amplify/auth';
import { I18n } from 'aws-amplify/utils';
import '@aws-amplify/ui-react/styles.css';
import { Button, Card, Flex, Loader, translations, useAuthenticator } from '@aws-amplify/ui-react';

import { useTranslation } from 'react-i18next';
import './i18n';

import AppContent from './components/AppContent';

const MISTRAL_ENABLED: boolean =
    import.meta.env.VITE_APP_ENABLE_MISTRAL === 'true';

const App: React.FC = () => {
  const {t, i18n} = useTranslation();

  useEffect(() => {
    // set header title
    document.title = !MISTRAL_ENABLED
        ? t('app.name')
        : t('app.nameWithoutClaude');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_APP_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_APP_USER_POOL_CLIENT_ID,
        loginWith: {
          oauth: {
            domain: 'admin-am-end-users.prod.aschehoug.cloud',
            scopes: ['email', 'openid', 'profile'],
            redirectSignIn: [window.origin],
            redirectSignOut: [window.origin],
            responseType: 'code',
          },
        },
      },
    },
  });

  I18n.putVocabularies(translations);
  I18n.setLanguage(i18n.language);

  const {authStatus} = useAuthenticator(context => [context.authStatus]);
 /*
  const {switchOpen: switchDrawer} = useDrawer();
  const {conversationId} = useParams();
  const {getTitle} = useConversation();
  const {isGeneratedTitle} = useChat();*/

  /* const navigate = useNavigate();
const onClickNewChat = useCallback(() => {
   navigate('');
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);*/

  if (authStatus === 'configuring') {
    return (
        <Loader
            size="large"
            variation="linear"
            ariaLabel="Laster inn..."
        />
    )
  } else if (authStatus !== 'authenticated') {
    return (
        <div className="relative flex h-screen w-screen bg-aws-paper">
          <main className="relative min-h-screen flex-1 overflow-y-hidden transition-width">
            <header
                className="visible flex h-12 w-full items-center bg-aws-squid-ink p-3 text-lg text-aws-font-color-white">
              Velkommen til GPT-tjenesten hos Aschehoug!
            </header>

            <Card variation="elevated">
              <Flex direction="column">
                <p>
                  Før du dykker inn i samtaler med vår AI, er det viktig å forstå noen grunnleggende retningslinjer og
                  sikkerhetstiltak:
                </p>

                <p>
                  Konfidensialitet: Informasjonen du deler her anses som strengt konfidensiell. Den brukes ikke til å
                  trene modellen og deles ikke med noen utenforstående parter.
                </p>

                <p>
                  Beta-versjon: Vær oppmerksom på at denne tjenesten er i betafasen. Dette betyr at det kan forekomme
                  ustabilitet, og chat-historikken din kan når som helst forsvinne uten forvarsel.
                </p>

                <p>
                  Eksklusiv tilgang: Tilgang til denne tjenesten er begrenset til ansatte med en gyldig aschehoug og
                  universitetsforlaget e-postadresse. Det er avgjørende at du ikke deler tilgangen med personer utenfor
                  organisasjonen.
                </p>


                <p>
                  Ved å klikke "OK" nedenfor bekrefter du at du har lest og forstått disse vilkårene, og at du
                  forplikter deg til å bruke GPT-tjenesten i samsvar med dem.
                </p>

                <Button variation="primary" onClick={() =>signInWithRedirect()}>
                  {/*<Button variation="primary" onClick={() => Auth.federatedSignIn({customProvider: 'AschehougAD'})}>*/}
                  Jeg forstår, logg meg inn!
                </Button>
              </Flex>
            </Card>
          </main>
        </div>
    )
  } else {
    return (
        <AppContent />

    )
  }
};


export default App;
