import React, {useEffect, useState} from 'react';
import {Platform, View} from 'react-native';

import {Typography} from '../../components';
import {useAuth} from '../../store/auth';
import {useNavigationStore} from '../../store/navigation';
import {utf8StringToUint8Array} from '../../utils/format';
import {
  generatePassword,
  getCredentialsWithBiometry,
  isBiometrySupported,
  saveCredentialsWithBiometry,
} from '../../utils/keychain';
import {generateRandomKeypair, getPublicKeyFromSecret} from '../../utils/keypair';
import {retrievePublicKey, storePrivateKey, storePublicKey} from '../../utils/storage';
import {
  Container,
  CreateAccountButton,
  ImportButton,
  Input,
  InputContainer,
  LoginButton,
  Logo,
  SkipButton,
  Text,
} from './styled';

enum LoginStep {
  HOME = 'HOME',
  IMPORT = 'IMPORT',
  CREATE_ACCOUNT = 'CREATE_ACCOUNT',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  EXPORTED_ACCOUNT = 'EXPORTED_ACCOUNT',
}

export default function Login() {
  const setNavigationStack = useNavigationStore((state) => state.setStack);
  const setAuth = useAuth((state) => state.setAuth);

  const [step, setStep] = useState<LoginStep>(LoginStep.HOME);
  const [bypassBiometric, setBiometrics] = useState<boolean>(Platform.OS == 'web' ? true : false); // DEV MODE in web to bypass biometric connection
  const [isSkipAvailable, setIsSkipAvailable] = useState<boolean>(true); // skip button available if possible to read data only without be connected
  const [isConnected, setIsConnected] = useState<boolean>(false); // skip button available if possible to read data only without be connected
  const [username, setUsername] = useState<string | undefined>();
  const [password, setPassword] = useState<string | undefined>();
  const [publicKey, setPublicKey] = useState<string | undefined>();
  const [privateKeyImport, setImportPrivateKey] = useState<string | undefined>();
  const [privateKey, setPrivateKey] = useState<Uint8Array | undefined>();
  const [privateKeyReadable, setPrivateKeyReadable] = useState<string | undefined>();

  const isImportDisabled: boolean =
    !password || !privateKeyImport || (password?.length == 0 && privateKeyImport?.length == 0)
      ? true
      : false;

  /** TODO check if user is already connected with a Nostr private key */
  useEffect(() => {
    const isConnectedUser = async () => {
      try {
        const publicKeyConnected = await retrievePublicKey();

        if (!publicKeyConnected) {
          alert('Please login');
          return;
        } else {
          setIsConnected(true);
          setPublicKey(publicKeyConnected);
        }
      } catch (e) {}
    };

    isConnectedUser();
  }, []);

  /** Create private key
   * Saved it with a password credentials biometrics
   * Add on localstorage
   */
  const handleCreateAccount = async () => {
    if (username?.length == 0 || !username) {
      alert('Enter username to login');
      return;
    }
    if (password?.length == 0 || !password) {
      alert('Enter password');
      return;
    }

    const biometrySupported = await isBiometrySupported();
    // @TODO (biometrySupported) uncomment web mode
    if (biometrySupported || bypassBiometric) {
      // Save credentials with biometric protection
      await saveCredentialsWithBiometry(username, password);
      const credentialsSaved = await generatePassword(username, password);
      // Retrieve credentials with biometric authentication
      const credentials = await getCredentialsWithBiometry();
      if (credentials) {
        /**Generate keypair */
        const {secretKey, secretKeyHex, publicKey} = generateRandomKeypair();

        setPublicKey(publicKey);
        setPrivateKey(secretKey);
        await storePublicKey(publicKey);
        setPrivateKeyReadable(secretKeyHex);

        /** Save pk in localstorage */
        const encryptedPk = await storePrivateKey(secretKeyHex, credentials?.password);
        const storedPk = await storePublicKey(publicKey);

        setAuth(publicKey, secretKey);
      } else if (bypassBiometric) {
        /** @TODO comment web mode */
        /**Generate keypair */
        const {secretKey, secretKeyHex, publicKey} = generateRandomKeypair();
        setPublicKey(publicKey);
        setPrivateKey(secretKey);
        setPrivateKeyReadable(secretKeyHex);
        /** Save pk in localstorage */
        await storePublicKey(publicKey);
        const encryptedPk = await storePrivateKey(secretKeyHex, password);

        setAuth(publicKey, secretKey);
        setStep(LoginStep.ACCOUNT_CREATED);
        alert(JSON.stringify('Biometric authentication failed or credentials not found.'));
      }
    } else {
      console.log('Biometry not supported on this device.');
      alert('Biometry not supported on this device.');
    }
  };

  /** Import private key
   * Saved it with a password credentials biometrics
   * Add on localstorage
   *
   */
  const handleImportPrivateKey = async () => {
    if (privateKeyImport?.length == 0) {
      alert('Enter a key to import');
      return;
    }
    if (password?.length == 0) {
      alert('Enter a password');
      return;
    }
    const biometrySupported = await isBiometrySupported();
    // @TODO (biometrySupported) uncomment web mode
    // BY PASS in dev web
    if (biometrySupported || bypassBiometric) {
      // Save credentials with biometric protection
      await saveCredentialsWithBiometry(username, password);
      const credentialsSaved = await generatePassword(username, password);
      // Retrieve credentials with biometric authentication
      const credentials = await getCredentialsWithBiometry();
      if (credentials) {
        /** @TODO comment web mode */
        // let keypairImport = await base64ToUint8Array(privateKeyImport);
        const keypairImport = await utf8StringToUint8Array(privateKeyImport);
        const publicKey = getPublicKeyFromSecret(privateKeyImport);
        setPublicKey(publicKey);

        /** Save pk in localstorage */
        const encryptedPk = await storePrivateKey(privateKeyImport, password);

        if (privateKeyImport && keypairImport) {
          setPrivateKeyReadable(privateKeyImport);
          setIsSkipAvailable(true);
          setStep(LoginStep.EXPORTED_ACCOUNT);
          await storePublicKey(publicKey);

          setAuth(publicKey, keypairImport);
        }

        // let storedPk = await storePublicKey(pk);
      } else if (bypassBiometric) {
        /** @TODO comment web mode */
        // let keypairImport = await base64ToUint8Array(privateKeyImport);
        const keypairImport = await utf8StringToUint8Array(privateKeyImport);
        const publicKey = getPublicKeyFromSecret(keypairImport);
        setPublicKey(publicKey);
        /** Save pk in localstorage */
        const encryptedPk = await storePrivateKey(privateKeyImport, password);

        if (privateKeyImport && keypairImport) {
          setPrivateKeyReadable(privateKeyImport);
          setIsSkipAvailable(true);
          await storePublicKey(publicKey);
          setStep(LoginStep.EXPORTED_ACCOUNT);

          setAuth(publicKey, keypairImport);
        }

        alert(JSON.stringify('Biometric authentication failed or credentials not found.'));
      }
    } else {
      console.log('Biometry not supported on this device.');
      alert('Biometry not supported on this device.');
    }
  };

  return (
    <Container>
      <Logo source={require('../../../assets/joyboy-logo.png')} resizeMode="contain" />

      {step == LoginStep.HOME && (
        <InputContainer>
          {/* <Text>Enter your login for Nostr</Text> */}
          <Input
            $focused={false}
            placeholderTextColor="#888"
            placeholder="Enter your login key"
            value={privateKeyImport}
            onChangeText={setImportPrivateKey}
          />
          <Input
            $focused={false}
            placeholder="Enter a password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
          />

          <ImportButton
            onPress={handleImportPrivateKey}
            style={{
              paddingVertical: 8,
              width: '100%',
              backgroundColor: isImportDisabled && 'gray',
            }}
            disabled={isImportDisabled}
          >
            <Typography variant="ts19m">Login</Typography>
          </ImportButton>
        </InputContainer>
      )}
      {step == LoginStep.EXPORTED_ACCOUNT && (
        <View
          style={{
            paddingHorizontal: 12,
            gap: 4,
            padding: 8,
            width: 230,
          }}
        >
          {publicKey && <Text selectable={true}>{publicKey}</Text>}

          {privateKeyReadable && (
            <>
              <Text selectable={true}>{privateKeyReadable}</Text>
            </>
          )}
        </View>
      )}

      {step != LoginStep.CREATE_ACCOUNT && step != LoginStep.EXPORTED_ACCOUNT && (
        <InputContainer>
          <CreateAccountButton
            onPress={() => setStep(LoginStep.CREATE_ACCOUNT)}
            style={{
              paddingVertical: 8,
              marginVertical: 8,
              width: '100%',
            }}
          >
            <Typography variant="ts19m">Create an account</Typography>
          </CreateAccountButton>
        </InputContainer>
      )}

      <InputContainer>
        <View>
          {step == LoginStep.CREATE_ACCOUNT && (
            <View>
              <Input
                placeholderTextColor="#888"
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
              />
              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={true}
              />

              <LoginButton
                onPress={handleCreateAccount}
                style={{
                  paddingVertical: 8,
                  marginVertical: 8,
                }}
              >
                <Typography variant="ts19m">Create</Typography>
              </LoginButton>

              <CreateAccountButton
                onPress={() => setStep(LoginStep.HOME)}
                style={{
                  paddingVertical: 8,
                  marginVertical: 8,
                  width: '100%',
                }}
                disabled={privateKeyImport?.length == 0}
              >
                <Typography variant="ts19m">Try login with an account</Typography>
              </CreateAccountButton>

              <View
                style={{
                  paddingHorizontal: 12,
                  gap: 4,
                  padding: 8,
                  width: 230,
                }}
              >
                {publicKey && <Text selectable={true}>{publicKey}</Text>}

                {privateKey && (
                  <>
                    <Text selectable={true}>{Uint8Array.from(privateKey)}</Text>
                  </>
                )}
              </View>
            </View>
          )}

          {step == LoginStep.ACCOUNT_CREATED && (
            <View
              style={{
                paddingHorizontal: 12,
                gap: 4,
                padding: 8,
                width: 230,
              }}
            >
              {publicKey && <Text selectable={true}>{publicKey}</Text>}

              {privateKeyReadable && (
                <>
                  <Text selectable={true}>{privateKeyReadable}</Text>
                </>
              )}
            </View>
          )}
        </View>
      </InputContainer>

      {isConnected && (
        <View
          style={{
            paddingHorizontal: 12,
            gap: 4,
            padding: 8,
            width: 230,
          }}
        >
          <Typography>You have a connected account.</Typography>
          {publicKey && <Text selectable={true}>{publicKey}</Text>}
        </View>
      )}

      {isSkipAvailable && (
        <SkipButton onPress={() => setNavigationStack('app')}>
          <Typography variant="ts19m">Skip</Typography>
        </SkipButton>
      )}
    </Container>
  );
}
