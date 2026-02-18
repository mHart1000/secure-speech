# SecureSpeech

A browser extension providing local, private speech-to-text via Vosk WASM. All recognition runs client-side — no audio ever leaves the device.

## If Developing on Windows

All git operations must be run from WSL to maintain git-crypt encryption on spec files. Requires `git-crypt` (`sudo apt install git-crypt`) and the repo key.

```bash
git clone git@github.com:mhart1000/secure-speech.git
cd secure-speech
echo "PASTE_BASE64_KEY_HERE" | base64 -d > ~/secure-speech-git-crypt.key
git-crypt unlock ~/secure-speech-git-crypt.key && rm ~/secure-speech-git-crypt.key  # decrypts .github/ and installs git filters
git config core.hooksPath hooks  # activates pre-push hook that blocks pushes from Windows git
```
