import React, { useState, useEffect, useMemo } from 'react';
import { Wheel } from 'react-custom-roulette';
import Modal from 'react-modal';
import '@solana/wallet-adapter-react-ui/styles.css';
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from '@solana/wallet-adapter-react';
import {
  WalletMultiButton,
  WalletModalProvider,
} from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
  Connection,
  clusterApiUrl,
  Transaction,
  SystemProgram,
  PublicKey,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { functions, db } from './firebase';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
} from 'firebase/firestore';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles.css';

const defaultSlot = {
  option: 'EMPTY',
  style: { backgroundColor: 'lightgray', textColor: 'white' },
};

export default function App() {
  const network = 'mainnet-beta';
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  const { publicKey, connected, signTransaction } = useWallet();
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isJoinDisabled, setIsJoinDisabled] = useState(false);
  const [timerMessage, setTimerMessage] = useState('Waiting for Users');
  const [timeLeft, setTimeLeft] = useState(null);
  const [winnerIndex, setWinnerIndex] = useState(null);
  const RECEIVER_ADDRESS = '3DGp8MGVHuUmzFv7uSJbHee45VNftrM3jpvDPTAjHQ7V';
  const totalPot = participants.length * 0.1;
  const [hasSpun, setHasSpun] = useState(false); // New flag for tracking spin status
  useEffect(() => {
    const roundsRef = collection(db, 'rounds');
    const activeRoundQuery = query(
      roundsRef,
      where('active', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(activeRoundQuery, (snapshot) => {
      if (!snapshot.empty) {
        const activeRound = snapshot.docs[0].data();
        setParticipants(activeRound.participants || []);
        if (activeRound.active) {
          setIsJoinDisabled(false);
        }
        if (!activeRound.started && !activeRound.completed) {
          setIsJoinDisabled(false); // Allow joining for new round
        }
        // Check and set winnerIndex if not spun yet
        if (
          activeRound.winnerIndex !== undefined &&
          activeRound.winnerIndex !== null
        ) {
          setWinnerIndex(activeRound.winnerIndex);
          setPrizeNumber(activeRound.winnerIndex);
        }

        // Countdown logic
        if (activeRound.started && activeRound.startTime) {
          const startTime = activeRound.startTime.seconds * 1000;
          const currentTime = Date.now();
          const timeRemaining = Math.max(0, startTime + 60000 - currentTime);
          setIsJoinDisabled(timeRemaining <= 1000);
          setTimeLeft(timeRemaining);
          setTimerMessage(timeRemaining > 0 ? 'Starting' : 'Spinning...');
        } else {
          setTimerMessage('Waiting for Users');
          setTimeLeft(null);
        }
      } else if (snapshot.empty) {
        // No active round, reset everything
        setParticipants([]);
        setIsJoinDisabled(false);
        setTimerMessage('Waiting for Users');
        setTimeLeft(null);
      }
    });

    return () => unsubscribe();
  }, [winnerIndex]);

  // Handle the spin if winnerIndex changes and hasn't spun yet
  useEffect(() => {
    if (winnerIndex != null && !hasSpun && timeLeft === 0) {
      setMustSpin(true);
      setHasSpun(true); // Ensure spin happens only once per winner
      setTimerMessage('Spinning...');
    }
  }, [winnerIndex, hasSpun, timeLeft]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };
  const onStopSpinning = () => {
    if (currentAccount && currentAccount.address) {
      // Compare the current user's address with the winner's address
      if (currentAccount.address === participants[winnerIndex]) {
        toast.success('Congratulations! You won this round!');
      } else {
        toast.info("Better luck next time! You didn't win this round.");
      }
    }
    // Introduce a 10-second delay before resetting states
    setTimeout(() => {
      setWinnerIndex(null); // Clear winnerIndex for the new round
      setMustSpin(false);
      setTimerMessage('Waiting for Users');
      setHasSpun(false); // Reset to allow spinning in the next round
    }, 5000); // 10-second delay before resetting
  };
  const [lastWinner, setLastWinner] = useState(null);

  useEffect(() => {
    const roundsRef = collection(db, 'rounds');
    const lastRoundQuery = query(
      roundsRef,
      where('completed', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(lastRoundQuery, (snapshot) => {
      if (!snapshot.empty) {
        const lastRoundData = snapshot.docs[0].data();
        setLastWinner(lastRoundData.winner);
      } else {
        setLastWinner(null); // Clear if no previous winner is found
      }
    });

    return () => unsubscribe();
  }, []);
  useEffect(() => {
    if (timeLeft > 0) {
      const targetTime = Date.now() + timeLeft; // Calculate the exact end time

      const countdown = () => {
        const now = Date.now();
        const timeRemaining = Math.max(0, targetTime - now);
        setTimeLeft(timeRemaining);

        if (timeRemaining > 0) {
          setTimeout(countdown, 100); // Re-trigger the countdown with a minimal delay
        } else {
          setTimerMessage('Spinning...');
        }
      };

      countdown(); // Start the countdown

      return () => clearTimeout(countdown); // Clear timeout on component unmount
    }
  }, [timeLeft]);

  const formatTimeLeft = () => {
    const seconds = Math.floor((timeLeft / 1000) % 60);
    return `${seconds}s`;
  };

  const wheelData = [
    ...participants.map((participant) => ({
      option:
        participant === currentAccount?.address
          ? 'YOU'
          : participant.slice(0, 5),
      style: { backgroundColor: '#f7faff', textColor: '#38b6ff' },
    })),
    ...Array(Math.max(5 - participants.length, 0)).fill(defaultSlot),
  ];

  const handleJoin = async () => {
    if (!connected || !publicKey) {
      toast.error('Wallet Not Connected');
      return;
    }

    if (processing) return;
    setProcessing(true);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: RECEIVER_ADDRESS,
        lamports: 100000000, // Example 0.1 SOL
      })
    );

    try {
      const connection = new Connection(endpoint, 'finalized');

      // Request signature from wallet
      const signedTransaction = await signTransaction(transaction);
      // Send and confirm the transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        signedTransaction,
        {
          commitment: 'finalized',
        }
      );

      toast.success('Successfully Joined Round!');
      const addUserToRound = httpsCallable(functions, 'addUserToRound');
      await addUserToRound({ userId: publicKey.toBase58() });
    } catch (error) {
      toast.error('Transaction Failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="App-Container">
            <ToastContainer position="top-right" autoClose={5000} />
            <img
              src="https://i.imgur.com/piz5thl.png"
              alt="Decorative Prop"
              className="image-prop"
            />
            <div className="App">
              <header className="header">
                <h1 className="title">DegenSUI</h1>
                <WalletMultiButton />
              </header>
              <div className="last-winner">
                Last Winner:{' '}
                {lastWinner ? (
                  <a
                    href={`https://suiscan.xyz/mainnet/account/${lastWinner}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="winner-link"
                  >
                    {lastWinner.slice(0, 6)}...{lastWinner.slice(-4)}
                  </a>
                ) : (
                  'No Winner Yet'
                )}
              </div>
              <div className="timer">
                {timerMessage} {timeLeft > 0 && `in ${formatTimeLeft()}`}
              </div>
              <div className="wheel-container">
                <div className="wheel">
                  <Wheel
                    mustStartSpinning={mustSpin}
                    prizeNumber={prizeNumber}
                    data={wheelData}
                    backgroundColors={['#f7faff', '#1a3a5f']}
                    textColors={['#38b6ff', '#f7faff']}
                    outerBorderColor="#30336b"
                    pointerProps={{ src: 'https://i.imgur.com/yeR3JqL.png' }}
                    outerBorderWidth={4}
                    innerRadius={2}
                    radiusLineColor="#38b6ff"
                    radiusLineWidth={5}
                    onStopSpinning={onStopSpinning}
                    fontFamily="Play Chickens"
                  />
                </div>
                <img
                  src="https://i.imgur.com/ClRwKdo.png"
                  alt="Wheel Overlay"
                  className="overlay"
                />
                <div className="total-pot-overlay">{totalPot} SOL</div>
              </div>
              <button
                className="join-button"
                onClick={handleJoin}
                disabled={isJoinDisabled || processing}
              >
                {processing ? 'Buying...' : 'Join for 0.1 SOL'}
              </button>
              <div className="social-links">
                <button className="about-button" onClick={openModal}>
                  How to play
                </button>
                <a
                  href="https://x.com/degenSUIcoin/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src="https://i.imgur.com/1FGkwQ0.jpeg"
                    alt="Twitter"
                    className="social-icon"
                  />
                </a>
                <a
                  href="https://t.me/DegenSUIcoin"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src="https://i.imgur.com/dA9g1A9.png"
                    alt="Telegram"
                    className="social-icon"
                  />
                </a>
                <a
                  href="https://movepump.com/token/0xb37826c87cc3b6cc26cb68ec30f9b9172a2152dacfe1ba5769a0935be92337b1::degen::DEGEN"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src="https://i.imgur.com/S6m51Aj.png"
                    alt="Movepump"
                    className="social-icon"
                  />
                </a>
              </div>
            </div>
            <Modal
              isOpen={isModalOpen}
              onRequestClose={closeModal}
              contentLabel="About the Game"
              className="Modal"
              overlayClassName="Overlay"
            >
              <h2>How to Play</h2>
              <br />
              <p>
                Welcome to the game! Here’s how it works:
                <br />
                <br />
                1. Join the game by paying the entry fee.
                <br />
                <br />
                2. Once enough players have joined, the countdown begins.
                <br />
                <br />
                3. When the timer ends, the wheel spins and selects a winner!
                <br />
                <br />
                <br />
                Enjoy and good luck!
                <br />
                <br />
                Fees are currently set at 20%.
                <br />
                <br />
                <br />
                Current Fee Revenue Schedule:
                <br />
                <br />
                Treasury: 0%
                <br />
                <br />
                $DEGEN Buy-Back Support: 100%
                <br />
                <br />
                <br />
                All Fees collected for the first week will be 100% bought back
                into our coin, we will post the Tx every night in Telegram.
                <br />
                <br />
              </p>
              <button onClick={closeModal} className="about-button">
                Close
              </button>
            </Modal>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
