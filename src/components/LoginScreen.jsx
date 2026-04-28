export default function LoginScreen({ login }) {
  return (
    <button onClick={login} className="bg-emerald-500 text-black px-6 py-3 rounded-lg font-bold hover:bg-emerald-400">
      Log In / Connect Wallet
    </button>
  );
}