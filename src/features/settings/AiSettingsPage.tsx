import {
  Alert,
  Autocomplete,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { Plug, Save } from "lucide-react";
import { useState, type ReactNode } from "react";
import { getErrorMessage } from "../../api";
import { listLocalModels } from "../../api/services/localAiApi";
import { useToast } from "../../app/useToast";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionCard } from "../../components/common/SectionCard";
import {
  AI_PROVIDER_PRESETS,
  MAX_TIMEOUT_SECONDS,
  MIN_TIMEOUT_SECONDS,
  isValidBaseUrl,
  normalizeBaseUrl,
  saveAiSettings,
  useAiSettings,
  type AiMode,
  type AiProviderId,
  type BrowserAiConfig,
  type LocalAiSettings,
  type OwnKeyAiSettings,
} from "../../config/aiSettings";
import { env } from "../../config/env";

type ConnectionResult =
  | { status: "ok"; models: string[] }
  | { status: "error"; message: string };

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

function hostOf(baseUrl: string): URL | null {
  try {
    return new URL(normalizeBaseUrl(baseUrl));
  } catch {
    return null;
  }
}

/** `http://` către o altă adresă decât localhost este blocat de browser când site-ul rulează pe HTTPS. */
function isMixedContent(baseUrl: string): boolean {
  if (window.location.protocol !== "https:") return false;
  const url = hostOf(baseUrl);
  return !!url && url.protocol === "http:" && !LOCAL_HOSTS.includes(url.hostname);
}

/** Cheia ar circula necriptat către o adresă din afara calculatorului. */
function isInsecureRemote(baseUrl: string): boolean {
  const url = hostOf(baseUrl);
  return !!url && url.protocol === "http:" && !LOCAL_HOSTS.includes(url.hostname);
}

interface EndpointFieldsProps {
  value: LocalAiSettings;
  models: string[];
  onChange: (patch: Partial<LocalAiSettings>) => void;
  timeoutText: string;
  onTimeoutChange: (text: string) => void;
  timeoutValid: boolean;
  urlHelp: string;
  modelHelp: string;
  visionHelp: string;
  /** Câmpuri specifice (furnizor, cheie) afișate înaintea adresei. */
  children?: ReactNode;
}

function EndpointFields({
  value,
  models,
  onChange,
  timeoutText,
  onTimeoutChange,
  timeoutValid,
  urlHelp,
  modelHelp,
  visionHelp,
  children,
}: EndpointFieldsProps) {
  const urlValid = isValidBaseUrl(value.baseUrl);
  return (
    <>
      {children}
      <TextField
        label="Adresa serverului AI"
        value={value.baseUrl}
        onChange={(event) => onChange({ baseUrl: event.target.value })}
        error={!urlValid}
        helperText={
          urlValid
            ? urlHelp
            : "Introdu o adresă validă care începe cu http:// sau https://"
        }
        fullWidth
      />
      {isMixedContent(value.baseUrl) && (
        <Alert severity="warning">
          Site-ul rulează pe HTTPS, iar browserul blochează apelurile către o
          adresă HTTP care nu este localhost. Folosește localhost sau o adresă
          HTTPS.
        </Alert>
      )}
      <Autocomplete
        freeSolo
        options={models}
        inputValue={value.model}
        onInputChange={(_, text) => onChange({ model: text })}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Model pentru recomandări"
            error={!value.model.trim()}
            helperText={modelHelp}
          />
        )}
      />
      <Autocomplete
        freeSolo
        options={models}
        inputValue={value.visionModel}
        onInputChange={(_, text) => onChange({ visionModel: text })}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Model pentru citirea bonurilor (opțional)"
            helperText={visionHelp}
          />
        )}
      />
      <TextField
        label="Timp maxim fără răspuns (secunde)"
        type="number"
        value={timeoutText}
        onChange={(event) => onTimeoutChange(event.target.value)}
        error={!timeoutValid}
        helperText={`Cât aștepți ca modelul să înceapă sau să continue răspunsul. Între ${MIN_TIMEOUT_SECONDS} și ${MAX_TIMEOUT_SECONDS}.`}
        slotProps={{
          htmlInput: { min: MIN_TIMEOUT_SECONDS, max: MAX_TIMEOUT_SECONDS },
        }}
        sx={{ maxWidth: 320 }}
      />
      <FormControlLabel
        control={
          <Switch
            checked={value.jsonMode}
            onChange={(event) => onChange({ jsonMode: event.target.checked })}
          />
        }
        label="Cere răspuns JSON (dezactivează dacă modelul îl refuză)"
      />
    </>
  );
}

function isTimeoutValid(text: string): boolean {
  const timeout = Number(text);
  return (
    Number.isInteger(timeout) &&
    timeout >= MIN_TIMEOUT_SECONDS &&
    timeout <= MAX_TIMEOUT_SECONDS
  );
}

export function AiSettingsPage() {
  const saved = useAiSettings();
  const toast = useToast();
  const [mode, setMode] = useState<AiMode>(saved.mode);
  const [local, setLocal] = useState<LocalAiSettings>(saved.local);
  const [ownKey, setOwnKey] = useState<OwnKeyAiSettings>(saved.ownKey);
  const [localTimeout, setLocalTimeout] = useState(
    String(saved.local.timeoutSeconds),
  );
  const [ownTimeout, setOwnTimeout] = useState(
    String(saved.ownKey.timeoutSeconds),
  );
  const [connection, setConnection] = useState<ConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);

  const endpoint = mode === "own-key" ? ownKey : local;
  const endpointValid =
    isValidBaseUrl(endpoint.baseUrl) &&
    isTimeoutValid(mode === "own-key" ? ownTimeout : localTimeout) &&
    !!endpoint.model.trim();
  const ownKeyValid =
    !!ownKey.apiKey.trim() && !isInsecureRemote(ownKey.baseUrl);
  const canSave =
    mode === "server" || (endpointValid && (mode !== "own-key" || ownKeyValid));

  const updateLocal = (patch: Partial<LocalAiSettings>) => {
    setLocal((current) => ({ ...current, ...patch }));
    setConnection(null);
  };
  const updateOwnKey = (patch: Partial<OwnKeyAiSettings>) => {
    setOwnKey((current) => ({ ...current, ...patch }));
    setConnection(null);
  };

  const changeProvider = (provider: AiProviderId) => {
    const preset = AI_PROVIDER_PRESETS[provider].settings;
    setOwnTimeout(String(preset.timeoutSeconds));
    updateOwnKey({ ...preset, provider });
  };

  const test = async () => {
    const config: BrowserAiConfig =
      mode === "own-key"
        ? { ...ownKey, baseUrl: normalizeBaseUrl(ownKey.baseUrl) }
        : { ...local, baseUrl: normalizeBaseUrl(local.baseUrl) };
    setTesting(true);
    setConnection(null);
    try {
      setConnection({ status: "ok", models: await listLocalModels(config) });
    } catch (error) {
      setConnection({ status: "error", message: getErrorMessage(error) });
    } finally {
      setTesting(false);
    }
  };

  const save = () => {
    const timeoutOf = (text: string, fallback: number) =>
      isTimeoutValid(text) ? Number(text) : fallback;
    saveAiSettings({
      mode,
      local: {
        ...local,
        baseUrl: normalizeBaseUrl(local.baseUrl),
        model: local.model.trim(),
        visionModel: local.visionModel.trim(),
        timeoutSeconds: timeoutOf(localTimeout, local.timeoutSeconds),
      },
      ownKey: {
        ...ownKey,
        baseUrl: normalizeBaseUrl(ownKey.baseUrl),
        model: ownKey.model.trim(),
        visionModel: ownKey.visionModel.trim(),
        apiKey: ownKey.apiKey.trim(),
        timeoutSeconds: timeoutOf(ownTimeout, ownKey.timeoutSeconds),
      },
    });
    toast.success("Setările AI au fost salvate.");
  };

  const models = connection?.status === "ok" ? connection.models : [];
  const missing =
    connection?.status === "ok" && models.length > 0
      ? [endpoint.model.trim(), endpoint.visionModel.trim()].filter(
          (name) => name && !models.includes(name),
        )
      : [];

  const connectionAlert = (
    <Box aria-live="polite">
      {connection?.status === "ok" && (
        <Alert severity={missing.length ? "warning" : "success"}>
          {models.length === 0
            ? "Conexiune reușită, dar serverul nu a listat niciun model."
            : `Conexiune reușită. Modele disponibile: ${models.join(", ")}.`}
          {missing.length > 0 &&
            ` Nu au fost găsite: ${missing.join(", ")}. Verifică numele modelelor.`}
        </Alert>
      )}
      {connection?.status === "error" && (
        <Alert severity="error">{connection.message}</Alert>
      )}
    </Box>
  );

  const testButton = (
    <Box>
      <Button
        variant="outlined"
        startIcon={<Plug size={18} />}
        onClick={test}
        disabled={
          !isValidBaseUrl(endpoint.baseUrl) ||
          testing ||
          (mode === "own-key" && !ownKey.apiKey.trim())
        }
      >
        {testing ? "Se testează..." : "Testează conexiunea"}
      </Button>
    </Box>
  );

  return (
    <>
      <PageHeader
        title="Setări AI"
        subtitle="Alege unde rulează modelul AI folosit pentru recomandări și pentru citirea bonurilor."
      />

      <Stack spacing={3} sx={{ maxWidth: 820 }}>
        {env.demoMode && (
          <Alert severity="info">
            În modul demo răspunsurile AI sunt simulate; setările de mai jos nu
            au efect.
          </Alert>
        )}

        <SectionCard title="Sursa modelului AI">
          <FormControl>
            <FormLabel id="ai-mode-label" sx={{ mb: 1 }}>
              Cum vrei să rulezi AI-ul?
            </FormLabel>
            <RadioGroup
              aria-labelledby="ai-mode-label"
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as AiMode);
                setConnection(null);
              }}
            >
              <FormControlLabel
                value="server"
                control={<Radio />}
                label={
                  <Box>
                    <Typography>Serverul aplicației</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Modelul este configurat de server (de exemplu OpenAI);
                      cheia serverului nu ajunge niciodată în browser.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", mb: 1 }}
              />
              <FormControlLabel
                value="own-key"
                control={<Radio />}
                label={
                  <Box>
                    <Typography>Cheia mea API (furnizor cu plată)</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Folosești contul tău la OpenAI, Groq, Google Gemini sau
                      alt furnizor compatibil. Browserul apelează direct
                      furnizorul cu cheia ta; costurile sunt ale contului tău.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", mb: 1 }}
              />
              <FormControlLabel
                value="local"
                control={<Radio />}
                label={
                  <Box>
                    <Typography>
                      Model local pe calculatorul meu (gratuit)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Browserul apelează direct Ollama (sau alt server
                      OpenAI-compatibil) de pe calculatorul tău. Funcționează
                      și când aplicația rulează în cloud, dar numai pe
                      calculatorul unde rulează modelul.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start" }}
              />
            </RadioGroup>
          </FormControl>
        </SectionCard>

        {mode === "own-key" && (
          <SectionCard
            title="Cheia mea API"
            subtitle="Setările și cheia sunt salvate doar în acest browser."
          >
            <Stack spacing={2.5}>
              <EndpointFields
                value={ownKey}
                models={models}
                onChange={updateOwnKey}
                timeoutText={ownTimeout}
                onTimeoutChange={setOwnTimeout}
                timeoutValid={isTimeoutValid(ownTimeout)}
                urlHelp="Adresa API-ului compatibil OpenAI al furnizorului"
                modelHelp="Ex.: gpt-4o-mini"
                visionHelp="Lasă gol ca să folosești același model ca la recomandări (trebuie să accepte imagini)"
              >
                <TextField
                  select
                  label="Furnizor"
                  value={ownKey.provider}
                  onChange={(event) =>
                    changeProvider(event.target.value as AiProviderId)
                  }
                >
                  {Object.entries(AI_PROVIDER_PRESETS).map(([id, preset]) => (
                    <MenuItem key={id} value={id}>
                      {preset.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Cheia API"
                  type="password"
                  value={ownKey.apiKey}
                  onChange={(event) =>
                    updateOwnKey({ apiKey: event.target.value })
                  }
                  autoComplete="off"
                  error={!ownKey.apiKey.trim()}
                  helperText="Cheia nu este trimisă serverului aplicației, ci doar furnizorului ales."
                  fullWidth
                />
              </EndpointFields>
              {isInsecureRemote(ownKey.baseUrl) && (
                <Alert severity="error">
                  Adresa folosește HTTP, iar cheia ar circula necriptat. Folosește
                  o adresă HTTPS.
                </Alert>
              )}
              {testButton}
              {connectionAlert}
              <Alert severity="info" variant="outlined">
                Cheia este păstrată în browserul acesta și poate fi citită de
                orice cod care rulează pe această pagină. Folosește o cheie cu
                limită de cheltuieli și nu o introduce pe un calculator
                folosit și de alții. Furnizorul primește cifre agregate
                (recomandări) sau poza bonului (citire bon).
              </Alert>
            </Stack>
          </SectionCard>
        )}

        {mode === "local" && (
          <SectionCard
            title="Model local"
            subtitle="Setările sunt salvate doar în acest browser."
          >
            <Stack spacing={2.5}>
              <EndpointFields
                value={local}
                models={models}
                onChange={updateLocal}
                timeoutText={localTimeout}
                onTimeoutChange={setLocalTimeout}
                timeoutValid={isTimeoutValid(localTimeout)}
                urlHelp="Pentru Ollama: http://localhost:11434/v1"
                modelHelp="Ex.: llama3.1:8b"
                visionHelp="Lasă gol ca să folosești același model ca la recomandări (trebuie să accepte imagini). Ex.: gemma4:26b, llava, llama3.2-vision"
              />
              {testButton}
              {connectionAlert}
              <Alert severity="info" variant="outlined">
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Pentru ca browserul să poată apela Ollama, pornește-l cu
                  adresa acestui site permisă:
                </Typography>
                <Box
                  component="code"
                  sx={{ display: "block", fontSize: 13, mb: 1 }}
                >
                  OLLAMA_ORIGINS={window.location.origin}
                </Box>
                <Typography variant="body2">
                  Pe Windows setează variabila de mediu și repornește aplicația
                  Ollama. Modelelor locale le sunt trimise doar cifre agregate,
                  direct de pe calculatorul tău. Modelele locale sunt mai lente
                  decât cele din cloud; mărește timpul de așteptare dacă este
                  nevoie. Chrome poate cere permisiunea de a accesa rețeaua
                  locală; Safari blochează apelurile către localhost dintr-o
                  pagină HTTPS.
                </Typography>
              </Alert>
            </Stack>
          </SectionCard>
        )}

        <Box>
          <Button
            variant="contained"
            startIcon={<Save size={18} />}
            onClick={save}
            disabled={!canSave}
          >
            Salvează setările
          </Button>
        </Box>
      </Stack>
    </>
  );
}
