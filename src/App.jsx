import React, { useState, useEffect } from 'react';
import { Shield, DollarSign, BookOpen, Users, Mail, Phone, MapPin, Lightbulb, Code, Briefcase, GraduationCap, UserCircle, PlusCircle, ThumbsUp, ThumbsDown, MessageSquare, Search, ChevronUp, ChevronDown, Gift, User } from 'lucide-react'; // Added User icon

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

// Main App Component
const App = () => {
  // State for Firebase instances and user data
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState('home'); // State for navigation
  const [showCookieConsent, setShowCookieConsent] = useState(false); // State for cookie consent banner
  const [cookieDeclineMessage, setCookieDeclineMessage] = useState(''); // State for cookie decline message

  // Firebase Initialization and Authentication
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        // Retrieve Firebase config from global variable
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const firebaseAuth = getAuth(app);

        setDb(firestore);
        setAuth(firebaseAuth);

        // Listen for auth state changes
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) {
            setUserId(user.uid);
            setIsAuthReady(true);

            // IMPORTANT: Ensure security rules are applied by attempting a write operation
            // This is a common pattern in environments like this to ensure the auth context
            // is fully propagated to Firestore security rules.
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const dummyDocRef = doc(firestore, `artifacts/${appId}/users/${user.uid}/profiles`, 'dummyDoc');
            try {
              await setDoc(dummyDocRef, { lastAccess: serverTimestamp() }, { merge: true });
              console.log("Dummy doc written to ensure security rules are active.");
            } catch (writeError) {
              console.warn("Could not write dummy doc (might be expected if doc exists or rules are very strict):", writeError);
            }

          } else {
            // Sign in anonymously if no user is found
            try {
              const anonymousUser = await signInAnonymously(firebaseAuth);
              setUserId(anonymousUser.user.uid);
              setIsAuthReady(true);

              // IMPORTANT: Ensure security rules are applied for anonymous user too
              const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
              const dummyDocRef = doc(firestore, `artifacts/${appId}/users/${anonymousUser.user.uid}/profiles`, 'dummyDoc');
              try {
                await setDoc(dummyDocRef, { lastAccess: serverTimestamp() }, { merge: true });
                console.log("Dummy doc written for anonymous user to ensure security rules are active.");
              } catch (writeError) {
                console.warn("Could not write dummy doc for anonymous user:", writeError);
              }

            } catch (error) {
              console.error("Error signing in anonymously:", error);
              setIsAuthReady(true); // Still set ready even if anonymous sign-in fails
            }
          }
        });

        // Attempt to sign in with custom token if available
        if (typeof __initial_auth_token !== 'undefined') {
          try {
            await signInWithCustomToken(firebaseAuth, __initial_auth_token);
          } catch (error) {
            console.error("Error signing in with custom token:", error);
          }
        }

        return () => unsubscribe(); // Cleanup auth listener on unmount
      } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        setIsAuthReady(true); // Ensure authReady is set even on error
      }
    };

    initializeFirebase();
  }, []); // Run only once on component mount

  // Fetch user profile when auth is ready and userId is available
  useEffect(() => {
    if (isAuthReady && db && userId) {
      const fetchProfile = async () => {
        setProfileLoading(true);
        try {
          // Get the app ID from the global variable
          const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
          const profileDocRef = doc(db, `artifacts/${appId}/users/${userId}/profiles`, 'myProfile');
          const profileSnap = await getDoc(profileDocRef);

          if (profileSnap.exists()) {
            setProfile(profileSnap.data());
          } else {
            // Initialize empty profile
            setProfile({ name: '', businessType: '' });
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
          // Fallback to empty profile on error
          setProfile({ name: '', businessType: '' });
        } finally {
          setProfileLoading(false);
        }
      };
      fetchProfile();
    }
  }, [isAuthReady, db, userId]); // Re-run when auth state or user ID changes

  // Cookie Consent Effect
  useEffect(() => {
    const consentGiven = localStorage.getItem('cookieConsent');
    if (!consentGiven) {
      setShowCookieConsent(true);
    }
  }, []);

  const handleAcceptCookies = () => {
    localStorage.setItem('cookieConsent', 'true');
    setShowCookieConsent(false);
  };

  const handleDeclineCookies = () => {
    localStorage.setItem('cookieConsent', 'false'); // Store that consent was declined
    setShowCookieConsent(false);
    setCookieDeclineMessage("You have declined cookies. Some non-essential features might be limited.");
    setTimeout(() => setCookieDeclineMessage(''), 5000); // Clear message after 5 seconds
  };

  // Function to save profile data
  const saveProfile = async (profileData) => {
    if (!db || !userId) {
      console.error("Firestore not initialized or user not authenticated.");
      return;
    }
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const profileDocRef = doc(db, `artifacts/${appId}/users/${userId}/profiles`, 'myProfile');
      await setDoc(profileDocRef, profileData, { merge: true });
      setProfile(profileData); // Update local state
      console.log("Profile saved successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  };

  // Profile Form Component
  const ProfileForm = () => {
    const [name, setName] = useState(profile?.name || '');
    const [businessType, setBusinessType] = useState(profile?.businessType || '');
    const [message, setMessage] = useState('');

    useEffect(() => {
      if (profile) {
        setName(profile.name || '');
        setBusinessType(profile.businessType || '');
      }
    }, [profile]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setMessage('Saving profile...');
      const dataToSave = {
        name,
        businessType,
      };
      await saveProfile(dataToSave);
      setMessage('Profile saved!');
      setTimeout(() => setMessage(''), 3000); // Clear message after 3 seconds
    };

    if (profileLoading) {
      return (
        <div className="text-center py-8 text-gray-600">Loading profile...</div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg mt-8">
        <h3 className="text-2xl font-bold text-indigo-800 mb-6 text-center">My Profile</h3>
        {userId && (
          <p className="text-sm text-gray-600 mb-4 text-center break-all">
            Your User ID: <span className="font-mono text-indigo-700">{userId}</span>
          </p>
        )}
        <p className="text-sm text-red-600 mb-4 text-center">
          **Important:** Your User ID is unique to this browser and session. If you clear your browser data or use a different device, your current User ID and associated profile data will be lost and **cannot be recovered**. Please keep a record of your User ID if you wish to retain your profile.
        </p>
        <p className="text-sm text-gray-700 mb-6 text-center">
          Serene AI values your privacy. We use this User ID solely to store your profile and contributions (like prompts and comments) within the app. We **do not track your personal data** for any other reason.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-gray-700 text-sm font-medium mb-1">Name:</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Your Name"
              required
            />
          </div>
          <div>
            <label htmlFor="businessType" className="block text-gray-700 text-sm font-medium mb-1">Business Type (e.g., SME, Freelancer, Content Creator):</label>
            <input
              type="text"
              id="businessType"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., Hair Salon Owner, TikTok Creator"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition-colors transform hover:scale-105"
          >
            Save Profile
          </button>
          {message && <p className="text-center text-sm mt-2 text-indigo-600">{message}</p>}
        </form>
      </div>
    );
  };

  // Prompt Library Component
  const PromptLibrary = ({ userId, profile, db }) => {
    const [prompts, setPrompts] = useState([]);
    const [newPromptTitle, setNewPromptTitle] = useState('');
    const [newPromptContent, setNewPromptContent] = useState('');
    const [submitMessage, setSubmitMessage] = useState('');
    const [commentText, setCommentText] = useState({}); // State to manage comment input for each prompt
    const [showComments, setShowComments] = useState({}); // State to toggle comment visibility

    // Fetch prompts from Firestore
    useEffect(() => {
      if (db) {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const promptsCollectionRef = collection(db, `artifacts/${appId}/public/data/prompts`);
        // Order by timestamp to show newest first
        const q = query(promptsCollectionRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedPrompts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Ensure likes and dislikes are objects for easier manipulation
            likes: doc.data().likes || {},
            dislikes: doc.data().dislikes || {},
          }));
          setPrompts(fetchedPrompts);
        }, (error) => {
          console.error("Error fetching prompts:", error);
        });

        return () => unsubscribe(); // Clean up listener
      }
    }, [db]);

    // Function to add a new prompt
    const addPrompt = async (e) => {
      e.preventDefault();
      if (!db || !userId || !newPromptTitle.trim() || !newPromptContent.trim()) {
        setSubmitMessage('Please fill in both title and content.');
        setTimeout(() => setSubmitMessage(''), 3000);
        return;
      }

      try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const promptsCollectionRef = collection(db, `artifacts/${appId}/public/data/prompts`);
        await addDoc(promptsCollectionRef, {
          title: newPromptTitle,
          content: newPromptContent,
          authorId: userId,
          // Store author's name for display
          authorName: profile?.name || `User ${userId.substring(0, 8)}...`,
          timestamp: serverTimestamp(),
          likes: {}, // Initialize with empty likes map
          dislikes: {}, // Initialize with empty dislikes map
        });
        setNewPromptTitle('');
        setNewPromptContent('');
        setSubmitMessage('Prompt submitted successfully!');
        setTimeout(() => setSubmitMessage(''), 3000);
      } catch (error) {
        console.error("Error adding prompt:", error);
        setSubmitMessage('Error submitting prompt.');
        setTimeout(() => setSubmitMessage(''), 3000);
      }
    };

    // Function to handle like/dislike
    const handleVote = async (promptId, type) => {
      if (!db || !userId) {
        console.error("Firestore not initialized or user not authenticated.");
        return;
      }

      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const promptDocRef = doc(db, `artifacts/${appId}/public/data/prompts`, promptId);

      try {
        const promptSnap = await getDoc(promptDocRef);
        if (promptSnap.exists()) {
          const data = promptSnap.data();
          let currentLikes = data.likes || {};
          let currentDislikes = data.dislikes || {};

          // Check if user has already voted
          const hasLiked = currentLikes[userId];
          const hasDisliked = currentDislikes[userId];

          if (type === 'like') {
            if (hasLiked) {
              // User already liked, so unlike
              delete currentLikes[userId];
            } else {
              // User hasn't liked, so like
              currentLikes[userId] = true;
              // If user previously disliked, remove dislike
              if (hasDisliked) {
                delete currentDislikes[userId];
              }
            }
          } else if (type === 'dislike') {
            if (hasDisliked) {
              // User already disliked, so undislike
              delete currentDislikes[userId];
            } else {
              // User hasn't disliked, so dislike
              currentDislikes[userId] = true;
              // If user previously liked, remove like
              if (hasLiked) {
                delete currentLikes[userId];
              }
            }
          }

          await setDoc(promptDocRef, { likes: currentLikes, dislikes: currentDislikes }, { merge: true });
        }
      } catch (error) {
        console.error("Error updating vote:", error);
      }
    };

    // Function to add a comment
    const addComment = async (promptId) => {
      if (!db || !userId || !commentText[promptId]?.trim()) {
        console.error("Comment text is empty or not authenticated.");
        return;
      }

      try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const commentsCollectionRef = collection(db, `artifacts/${appId}/public/data/prompts/${promptId}/comments`);
        await addDoc(commentsCollectionRef, {
          text: commentText[promptId],
          authorId: userId,
          // Store author's name directly for display in comments
          authorName: profile?.name || `User ${userId.substring(0, 8)}...`,
          timestamp: serverTimestamp(),
        });
        setCommentText(prev => ({ ...prev, [promptId]: '' })); // Clear comment input
      } catch (error) {
        console.error("Error adding comment:", error);
      }
    };

    return (
      <div className="max-w-4xl mx-auto py-16 px-6 md:px-12">
        <h3 className="text-3xl font-bold text-center text-indigo-800 mb-12">Prompt Library</h3>

        {/* Submit New Prompt Section */}
        <div className="bg-white p-8 rounded-xl shadow-lg mb-12">
          <h4 className="text-2xl font-semibold text-indigo-700 mb-6 flex items-center">
            <PlusCircle className="mr-2" size={24} /> Submit a New Prompt
          </h4>
          <form onSubmit={addPrompt} className="space-y-4">
            <div>
              <label htmlFor="promptTitle" className="block text-gray-700 text-sm font-medium mb-1">Prompt Title:</label>
              <input
                type="text"
                id="promptTitle"
                value={newPromptTitle}
                onChange={(e) => setNewPromptTitle(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="A catchy title for your prompt"
                required
              />
            </div>
            <div>
              <label htmlFor="promptContent" className="block text-gray-700 text-sm font-medium mb-1">Prompt Content:</label>
              <textarea
                id="promptContent"
                value={newPromptContent}
                onChange={(e) => setNewPromptContent(e.target.value)}
                rows="5"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Write your detailed AI prompt here..."
                required
              ></textarea>
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition-colors transform hover:scale-105"
            >
              Submit Prompt
            </button>
            {submitMessage && <p className="text-center text-sm mt-2 text-indigo-600">{submitMessage}</p>}
          </form>
        </div>

        {/* Display Prompts Section */}
        <div className="space-y-8">
          {prompts.length === 0 ? (
            <p className="text-center text-gray-600 text-lg">No prompts yet. Be the first to submit one!</p>
          ) : (
            prompts.map((prompt) => (
              <div key={prompt.id} className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
                <h4 className="text-xl font-semibold text-indigo-700 mb-2">{prompt.title}</h4>
                <p className="text-gray-700 mb-4 whitespace-pre-wrap">{prompt.content}</p>
                <p className="text-sm text-gray-500 mb-4 flex items-center">
                  Submitted by:
                  <span className="font-mono text-indigo-600 ml-1 break-all">
                    {prompt.authorName || `User ${prompt.authorId.substring(0, 8)}...`}
                  </span>
                  on {prompt.timestamp?.toDate().toLocaleString()}
                </p>

                {/* Like/Dislike Buttons */}
                <div className="flex items-center space-x-4 mb-4">
                  <button
                    onClick={() => handleVote(prompt.id, 'like')}
                    className={`flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      prompt.likes[userId] ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                    }`}
                  >
                    <ThumbsUp size={16} className="mr-1" /> {Object.keys(prompt.likes).length}
                  </button>
                  <button
                    onClick={() => handleVote(prompt.id, 'dislike')}
                    className={`flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      prompt.dislikes[userId] ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                    }`}
                  >
                    <ThumbsDown size={16} className="mr-1" /> {Object.keys(prompt.dislikes).length}
                  </button>
                  <button
                    onClick={() => setShowComments(prev => ({ ...prev, [prompt.id]: !prev[prompt.id] }))}
                    className="flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    <MessageSquare size={16} className="mr-1" /> Comments
                  </button>
                </div>

                {/* Comments Section */}
                {showComments[prompt.id] && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <h5 className="text-lg font-semibold text-indigo-600 mb-3">Comments</h5>
                    {/* Fetch and display comments for this prompt */}
                    <CommentsList promptId={prompt.id} db={db} userId={userId} />

                    {/* Add Comment Form */}
                    <div className="mt-4">
                      <textarea
                        value={commentText[prompt.id] || ''}
                        onChange={(e) => setCommentText(prev => ({ ...prev, [prompt.id]: e.target.value }))}
                        rows="2"
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                        placeholder="Add a comment..."
                      ></textarea>
                      <button
                        onClick={() => addComment(prompt.id)}
                        className="mt-2 bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors"
                      >
                        Post Comment
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // CommentsList Component to fetch and display comments for a specific prompt
  const CommentsList = ({ promptId, db, userId }) => {
    const [comments, setComments] = useState([]);

    useEffect(() => {
      if (db && promptId) {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const commentsCollectionRef = collection(db, `artifacts/${appId}/public/data/prompts/${promptId}/comments`);
        const q = query(commentsCollectionRef, orderBy('timestamp', 'asc')); // Order comments by oldest first

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedComments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setComments(fetchedComments);
        }, (error) => {
          console.error("Error fetching comments:", error);
        });

        return () => unsubscribe();
      }
    }, [db, promptId]);

    return (
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-sm">No comments yet.</p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p className="text-gray-800 text-sm">{comment.text}</p>
              <p className="text-xs text-gray-500 mt-1">
                By <span className="font-mono text-indigo-500 break-all">{comment.authorName || `User ${comment.authorId.substring(0, 8)}...`}</span> on {comment.timestamp?.toDate().toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    );
  };

  // AI FAQ Widget Component
  const AiFaqWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('All'); // Default category

    const faqs = [
      {
        category: "General AI",
        question: "What is Artificial Intelligence (AI)?",
        answer: "AI refers to the simulation of human intelligence in machines that are programmed to think like humans and mimic their actions. The term may also be applied to any machine that exhibits traits associated with a human mind such as learning and problem-solving.",
      },
      {
        category: "General AI",
        question: "What is Machine Learning (ML)?",
        answer: "Machine Learning is a subset of AI that enables systems to learn from data, identify patterns, and make decisions with minimal human intervention. It's the engine that powers many AI applications.",
      },
      {
        category: "Applications",
        question: "How is AI used in business?",
        answer: "AI is used in various business functions, including customer service (chatbots), data analysis, personalized marketing, fraud detection, supply chain optimization, and automation of repetitive tasks.",
      },
      {
        category: "Ethics",
        question: "What are the ethical concerns surrounding AI?",
        answer: "Key ethical concerns include algorithmic bias, job displacement, privacy violations, accountability for AI decisions, and the potential for misuse of powerful AI systems.",
      },
      {
        category: "Applications",
        question: "Can AI create art or music?",
        answer: "Yes, AI can generate original art, compose music, and even write poetry. AI models are trained on vast datasets of existing creative works to learn patterns and styles, which they then use to produce new content.",
      },
      {
        category: "General AI",
        question: "What is Deep Learning?",
        answer: "Deep Learning is a specialized subfield of Machine Learning that uses artificial neural networks with multiple layers (deep networks) to learn from data. It's particularly effective for complex tasks like image and speech recognition.",
      },
      {
        category: "Ethics",
        question: "How does GDPR relate to AI?",
        answer: "GDPR (General Data Protection Regulation) impacts AI by imposing strict rules on how personal data is collected, processed, and stored. AI systems must be designed with data privacy by design, ensuring transparency, accountability, and user rights regarding their data.",
      },
      {
        category: "Applications",
        question: "What is Natural Language Processing (NLP)?",
        answer: "NLP is a branch of AI that enables computers to understand, interpret, and generate human language. It's used in applications like voice assistants, translation software, and sentiment analysis.",
      },
    ];

    const categories = ['All', ...new Set(faqs.map(faq => faq.category))];

    const filteredFaqs = faqs.filter(faq => {
      const matchesSearch = searchTerm.toLowerCase() === '' ||
                            faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'All' || faq.category === activeCategory;
      return matchesSearch && matchesCategory;
    });

    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label={isOpen ? "Close FAQ Widget" : "Open FAQ Widget"}
        >
          {isOpen ? <ChevronDown size={28} /> : <ChevronUp size={28} />}
        </button>

        {isOpen && (
          <div className="bg-white rounded-xl shadow-xl w-80 md:w-96 p-6 absolute bottom-16 right-0 border border-gray-200 animate-fade-in-up">
            <h4 className="text-xl font-bold text-indigo-800 mb-4">AI FAQ</h4>

            {/* Search Bar */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search FAQs..."
                className="w-full p-2 pl-10 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    activeCategory === category
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* FAQ List */}
            <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {filteredFaqs.length === 0 ? (
                <p className="text-gray-600 text-center">No FAQs found for your search/category.</p>
              ) : (
                filteredFaqs.map((faq, index) => (
                  <div key={index} className="mb-4 pb-2 border-b border-gray-100 last:border-b-0">
                    <p className="font-semibold text-gray-800 mb-1">{faq.question}</p>
                    <p className="text-gray-700 text-sm">{faq.answer}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper to render content based on currentSection
  const renderContent = () => {
    switch (currentSection) {
      case 'home':
        return (
          <>
            {/* Hero Section */}
            <section id="home" className="relative text-center py-20 md:py-32 px-6 bg-indigo-600 text-white rounded-xl mx-4 mt-6 shadow-lg">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
                  Ethical AI, Built For You.
                </h2>
                <p className="text-lg md:text-xl mb-8 opacity-90">
                  Your trusted local tech partner for UK SMEs, delivering privacy-first tools and skills that empower communities to thrive in the digital era.
                </p>
                <button onClick={() => setCurrentSection('contact')} className="inline-block bg-white text-indigo-700 font-bold py-3 px-8 rounded-full shadow-lg hover:bg-indigo-50 transition-transform transform hover:scale-105">
                  Get Started Today
                </button>
              </div>
            </section>

            {/* About Section - Why We're Different (now part of home) */}
            <section id="about" className="py-16 px-6 md:px-12">
              <div className="max-w-6xl mx-auto">
                <h3 className="text-3xl font-bold text-center text-indigo-800 mb-12">Why Choose Serene AI?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  <div className="bg-white p-6 rounded-xl shadow-md flex flex-col items-center text-center transition-transform transform hover:scale-105 hover:shadow-lg">
                    <Shield className="text-green-500 mb-4" size={48} />
                    <h4 className="text-xl font-semibold mb-2">Privacy-First Solutions</h4>
                    <p className="text-gray-700">Locally hosted tools with no overseas servers, ensuring your data stays secure and compliant with GDPR.</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-md flex flex-col items-center text-center transition-transform transform hover:scale-105 hover:shadow-lg">
                    <DollarSign className="text-purple-500 mb-4" size={48} />
                    <h4 className="text-xl font-semibold mb-2">One-Off Cost Tools</h4>
                    <p className="text-gray-700">Say goodbye to subscription fatigue. Our tools offer a single, upfront cost for long-term savings.</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-md flex flex-col items-center text-center transition-transform transform hover:scale-105 hover:shadow-lg">
                    <BookOpen className="text-orange-500 mb-4" size={48} />
                    <h4 className="text-xl font-semibold mb-2">Education-Driven Approach</h4>
                    <p className="text-gray-700">Free tools and training for schools and community groups to build digital skills.</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-md flex flex-col items-center text-center transition-transform transform hover:scale-105 hover:shadow-lg">
                    <Users className="text-red-500 mb-4" size={48} />
                    <h4 className="text-xl font-semibold mb-2">Human-Centred Support</h4>
                    <p className="text-gray-700">Personalized 1:1 coaching and consulting to build your confidence and capability with AI.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* About Our Founder Section */}
            <section className="py-16 px-6 md:px-12 bg-white rounded-xl mx-4 mt-6 shadow-lg">
              <div className="max-w-4xl mx-auto text-center">
                <h3 className="text-3xl font-bold text-indigo-800 mb-8 flex items-center justify-center">
                  <User className="mr-3 text-indigo-600" size={36} /> About Our Founder
                </h3>
                <p className="text-lg text-gray-700 mb-6">
                  **Daniel Turner**, the visionary behind Serene AI, brings over 8 years of invaluable experience in automation, AI solutions, and customer service from his tenure at Sky. His journey into automation began during the early days of COVID-19, where a significant reduction in leadership roles led him to step up and create innovative solutions.
                </p>
                <p className="text-lg text-gray-700 mb-6">
                  Daniel designed, built, and managed four key automations that have been used over a million times, continuing to power operations even after his redundancy. This proven impact and dedication led him to establish Serene AI, driven by a passion to empower UK businesses with ethical, human-first automation.
                </p>
                <p className="text-lg text-gray-700">
                  His focus is on delivering solutions that are as **trustworthy as they are transformative**, ensuring that technology serves people first, protects their privacy, and supports them whenever needed, without locking them into costly subscriptions.
                </p>
              </div>
            </section>
          </>
        );
      case 'services':
        return (
          <section id="services" className="bg-white py-16 px-6 md:px-12 rounded-xl mx-4 shadow-lg">
            <div className="max-w-6xl mx-auto">
              <h3 className="text-3xl font-bold text-center text-indigo-800 mb-12">Our Services</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Small Website Generator - Self-Hosted Edition */}
                <div className="bg-blue-50 p-6 rounded-xl shadow-md flex flex-col transition-transform transform hover:scale-105 hover:shadow-lg">
                  <div className="flex items-center mb-4">
                    <Code className="text-indigo-600 mr-3" size={32} />
                    <h4 className="text-xl font-semibold text-indigo-700">Small Website Generator</h4>
                  </div>
                  <p className="text-gray-700 mb-4">
                    Launch and manage a professional webpage without ongoing subscription costs. Fully self-hosted for complete data control.
                  </p>
                  <p className="text-lg font-bold text-indigo-800 mt-auto">Price: £20-£50 (one-off)</p>
                </div>

                {/* Small Website Generator - Education Edition */}
                <div className="bg-green-50 p-6 rounded-xl shadow-md flex flex-col transition-transform transform hover:scale-105 hover:shadow-lg">
                  <div className="flex items-center mb-4">
                    <GraduationCap className="text-green-600 mr-3" size={32} />
                    <h4 className="text-xl font-semibold text-green-700">Website Generator - Education Edition</h4>
                  </div>
                  <p className="text-gray-700 mb-4">
                    A locally hosted tool designed to teach digital skills, helping students and community members create their own webpages.
                  </p>
                  <p className="text-lg font-bold text-green-800 mt-auto">Price: Free (for schools & community groups)</p>
                </div>

                {/* AI Coaching Sessions */}
                <div className="bg-purple-50 p-6 rounded-xl shadow-md flex flex-col transition-transform transform hover:scale-105 hover:shadow-lg">
                  <div className="flex items-center mb-4">
                    <Lightbulb className="text-purple-600 mr-3" size={32} />
                    <h4 className="text-xl font-semibold text-purple-700">AI Coaching Sessions</h4>
                  </div>
                  <p className="text-gray-700 mb-4">
                    One-to-one, personalized coaching on using AI and automation to streamline tasks, improve productivity, and build digital confidence.
                  </p>
                  <p className="text-lg font-bold text-purple-800 mt-auto">Price: £30/hour (typically 1 session/week)</p>
                </div>

                {/* SME Automation Consulting */}
                <div className="bg-orange-50 p-6 rounded-xl shadow-md flex flex-col transition-transform transform hover:scale-105 hover:shadow-lg">
                  <div className="flex items-center mb-4">
                    <Briefcase className="text-orange-600 mr-3" size={32} />
                    <h4 className="text-xl font-semibold text-orange-700">SME Automation Consulting</h4>
                  </div>
                  <p className="text-gray-700 mb-4">
                    Bespoke consulting for small businesses integrating AI solutions like chatbots, workflow automation, and local data hosting.
                  </p>
                  <p className="text-lg font-bold text-orange-800 mt-auto">Price: From £100/month</p>
                </div>
              </div>

              {/* Community Gifts Section */}
              <div className="mt-16 pt-8 border-t border-gray-200">
                <h3 className="text-3xl font-bold text-center text-indigo-800 mb-12 flex items-center justify-center">
                  <Gift className="mr-3 text-pink-600" size={36} /> Community Gifts
                </h3>
                <p className="text-center text-gray-700 mb-8 max-w-2xl mx-auto">
                  As part of our commitment to the UK community, we share valuable AI tools and resources to empower SMEs and content creators. These custom GPTs and Gems are designed to help you streamline your work and boost productivity.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-pink-50 p-6 rounded-xl shadow-md flex flex-col transition-transform transform hover:scale-105 hover:shadow-lg">
                    <h4 className="text-xl font-semibold text-pink-700 mb-2">Social Media Content Idea Generator (GPT)</h4>
                    <p className="text-gray-700 mb-4">
                      Stuck for ideas? This custom GPT helps content creators brainstorm engaging posts, hashtags, and campaign ideas for various platforms.
                    </p>
                    <a
                      href="https://chat.openai.com/g/your-sme-content-gpt-link" // Placeholder link
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-pink-600 text-white font-bold py-2 px-6 rounded-full text-sm self-start hover:bg-pink-700 transition-colors"
                    >
                      Access GPT
                    </a>
                  </div>
                  <div className="bg-yellow-50 p-6 rounded-xl shadow-md flex flex-col transition-transform transform hover:scale-105 hover:shadow-lg">
                    <h4 className="text-xl font-semibold text-yellow-700 mb-2">UK Business Grant Finder (Gem)</h4>
                    <p className="text-gray-700 mb-4">
                      A powerful tool to help UK SMEs quickly identify relevant government grants and funding opportunities based on their industry and needs.
                    </p>
                    <a
                      href="https://gemini.google.com/app/your-grant-finder-gem-link" // Placeholder link
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-yellow-600 text-white font-bold py-2 px-6 rounded-full text-sm self-start hover:bg-yellow-700 transition-colors"
                    >
                      Access Gem
                    </a>
                  </div>
                  <div className="bg-teal-50 p-6 rounded-xl shadow-md flex flex-col transition-transform transform hover:scale-105 hover:shadow-lg">
                    <h4 className="text-xl font-semibold text-teal-700 mb-2">Local SEO Keyword Assistant (GPT)</h4>
                    <p className="text-gray-700 mb-4">
                      Optimize your local online presence! This GPT assists UK businesses in finding hyper-local keywords to attract nearby customers.
                    </p>
                    <a
                      href="https://chat.openai.com/g/your-seo-gpt-link" // Placeholder link
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-teal-600 text-white font-bold py-2 px-6 rounded-full text-sm self-start hover:bg-teal-700 transition-colors"
                    >
                      Access GPT
                    </a>
                  </div>
                  <div className="bg-cyan-50 p-6 rounded-xl shadow-md flex flex-col transition-transform transform hover:scale-105 hover:shadow-lg">
                    <h4 className="text-xl font-semibold text-cyan-700 mb-2">Invoice & Receipt Categorizer (Gem)</h4>
                    <p className="text-gray-700 mb-4">
                      Simplify your bookkeeping! This Gem helps freelancers and small businesses quickly categorize expenses from invoices and receipts.
                    </p>
                    <a
                      href="https://gemini.google.com/app/your-invoice-gem-link" // Placeholder link
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-cyan-600 text-white font-bold py-2 px-6 rounded-full text-sm self-start hover:bg-cyan-700 transition-colors"
                    >
                      Access Gem
                    </a>
                  </div>
                </div>
                <p className="text-center text-gray-600 text-sm mt-8">
                  *Note: These are illustrative examples. You would replace the "Access GPT" and "Access Gem" links with your actual custom GPT/Gem URLs.
                </p>
              </div>
            </div>
          </section>
        );
      case 'contact':
        return (
          <section id="contact" className="py-16 px-6 md:px-12">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-lg">
              <h3 className="text-3xl font-bold text-center text-indigo-800 mb-8">Get In Touch</h3>
              <p className="text-center text-gray-700 mb-8">
                Ready to explore how ethical AI and automation can transform your business? Contact us today!
              </p>
              <div className="flex flex-col md:flex-row justify-around items-center space-y-6 md:space-y-0 md:space-x-8">
                <div className="flex items-center text-gray-800">
                  <Mail className="text-indigo-600 mr-3" size={24} />
                  <a href="mailto:info@sereneai.co.uk" className="hover:underline">info@sereneai.co.uk</a>
                </div>
                <div className="flex items-center text-gray-800">
                  <Phone className="text-indigo-600 mr-3" size={24} />
                  <a href="tel:07368312589" className="hover:underline">07368-312-589</a>
                </div>
                <div className="flex items-center text-gray-800">
                  <MapPin className="text-indigo-600 mr-3" size={24} />
                  <span>Blackpool, England, UK</span>
                </div>
              </div>
            </div>
          </section>
        );
      case 'profile':
        return <ProfileForm />;
      case 'prompt-library':
        return <PromptLibrary userId={userId} profile={profile} db={db} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-900 font-sans">
      {/* Tailwind CSS CDN - Included for rendering in browser */}
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-6 md:px-12 flex justify-between items-center rounded-b-xl">
        <div className="flex items-center">
          <Lightbulb className="text-indigo-600 mr-2" size={28} />
          <h1 className="text-2xl font-bold text-indigo-800">Serene AI</h1>
        </div>
        <nav className="hidden md:flex items-center space-x-6">
          <button onClick={() => setCurrentSection('home')} className="text-gray-700 hover:text-indigo-600 font-medium transition-colors px-3 py-2 rounded-md">Home</button>
          <button onClick={() => setCurrentSection('services')} className="text-gray-700 hover:text-indigo-600 font-medium transition-colors px-3 py-2 rounded-md">Services & Gifts</button>
          <button onClick={() => setCurrentSection('prompt-library')} className="text-gray-700 hover:text-indigo-600 font-medium transition-colors px-3 py-2 rounded-md">Prompt Library</button>
          <button onClick={() => setCurrentSection('contact')} className="text-gray-700 hover:text-indigo-600 font-medium transition-colors px-3 py-2 rounded-md">Contact</button>
          <button onClick={() => setCurrentSection('profile')} className="text-gray-700 hover:text-indigo-600 font-medium transition-colors flex items-center px-3 py-2 rounded-md">
            <UserCircle size={20} className="mr-1" /> My Profile
          </button>
        </nav>
        {/* Mobile menu button (can be expanded with state for functionality) */}
        <button className="md:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
        </button>
      </header>

      {/* Cookie Decline Message */}
      {cookieDeclineMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-down">
          {cookieDeclineMessage}
        </div>
      )}

      {/* Render current section content */}
      {renderContent()}

      {/* Cookie Consent Banner */}
      {showCookieConsent && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-4 flex flex-col md:flex-row items-center justify-between shadow-lg z-50">
          <p className="text-sm text-center md:text-left mb-3 md:mb-0">
            We use cookies to ensure you get the best experience on our website. By continuing to use this site, you agree to our <a href="#privacy-policy" className="underline font-medium hover:text-indigo-300">Privacy Policy</a>.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={handleAcceptCookies}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Accept
            </button>
            <button
              onClick={handleDeclineCookies}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-indigo-800 text-white py-8 px-6 md:px-12 mt-8 rounded-t-xl">
        <div className="max-w-6xl mx-auto text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Serene AI Ltd. All rights reserved.</p>
          <p className="mt-2">Ethical AI, Built For You.</p>
          <p className="mt-2">
            <a href="#privacy-policy" className="underline hover:text-indigo-300">Privacy Policy (GDPR)</a>
          </p>
        </div>
      </footer>

      {/* AI FAQ Widget */}
      <AiFaqWidget />
    </div>
  );
};

export default App;
