import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  Award,
  BookOpen,
  Users,
  Target,
  Building2,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Sun,
  Moon,
  Menu,
  X,
  GraduationCap,
  Sparkles,
  Compass,
  Scale,
  ChevronRight,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useBranding } from '../context/BrandingContext';

const Home: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { branding } = useBranding();
  const navigate = useNavigate();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeGalleryTab, setActiveGalleryTab] = useState<'all' | 'parade' | 'tactical' | 'academic' | 'campus'>('all');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const stats = [
    { label: 'Graduated Police Officers', value: '52,000+', icon: Award, desc: 'Serving proudly across Punjab districts' },
    { label: 'Active Cadet Capacity', value: '1,500+', icon: Users, desc: 'Undergoing rigorous foundational training' },
    { label: 'Master Instructors & Faculty', value: '140+', icon: GraduationCap, desc: 'Drill masters, legal scholars & investigators' },
    { label: 'Decades of Noble Service', value: 'Historic', icon: Shield, desc: 'Pioneer police training academy in Pakistan' },
  ];

  const institutionalPillars = [
    {
      title: 'Discipline & Honor',
      urdu: 'نظم و ضبط اور عزتِ نفس',
      icon: Shield,
      desc: 'Forging ironclad character, immaculate uniform deportment, and unshakeable pride in the badge.',
      accent: 'border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Tactical & Combat Readiness',
      urdu: 'حکمتِ عملی اور جنگی مہارت',
      icon: Target,
      desc: 'Mastery in weapon handling, tactical marksmanship, obstacle endurance, and rapid incident response.',
      accent: 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400',
    },
    {
      title: 'Legal Rigor & Investigation',
      urdu: 'قانون فہمی اور پیشہ ورانہ تفتیش',
      icon: Scale,
      desc: 'Deep study of the Pakistan Penal Code, CrPC, forensic evidence collection, and transparent case work.',
      accent: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Service & Human Dignity',
      urdu: 'خدمتِ خلق اور انسانی اقدار',
      icon: Compass,
      desc: 'Instilling public-friendly courtesy, gender sensitivity, crisis de-escalation, and citizen protection.',
      accent: 'border-indigo-500/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400',
    }
  ];

  const trainingWings = [
    {
      id: 'drill',
      title: 'Drill & Ceremonial Weapons Wing',
      urdu: 'ڈرل اور ویپنز ونگ',
      icon: Target,
      image: '/images/pts_tactical_drill.jpg',
      desc: 'Rigorous squad drill, ceremonial quarter guard, tactical marksmanship, obstacle agility, and counter-riot formation maneuvers.',
      points: ['Ceremonial Passing Out Drills', 'Live Firing Butts & Range Practice', 'Advanced Obstacle Course', 'Anti-Riot Formations']
    },
    {
      id: 'law',
      title: 'Law & Criminal Investigation Directorate',
      urdu: 'قانون اور تفتیش کا شعبہ',
      icon: BookOpen,
      image: '/images/pts_smart_class.jpg',
      desc: 'Academic grounding in Pakistan Penal Code, Criminal Procedure Code (CrPC), Evidence Act, mock courtroom drills, and FIR drafting.',
      points: ['Mock Trials & Court Procedures', 'Crime Scene Preservation & Forensics', 'Case Diary (Zimni) Documentation', 'Human Rights & Fair Trial Protocols']
    },
    {
      id: 'tactical',
      title: 'Rapid Response & Tactical Operations Cell',
      urdu: 'ریپڈ رسپانس اور سپیشل آپریشنز',
      icon: Shield,
      image: '/images/pts_hero_parade.jpg',
      desc: 'Specialized tactical motorcycle maneuvering, high-speed interception, live pursuit ethics, and combat trauma first-aid.',
      points: ['High-Speed Tactical Maneuvers', 'Building Clearing & Close Quarter Defense', 'Trauma Care & Medical Response', 'VIP Escort Protocols']
    },
    {
      id: 'cadets',
      title: 'Cadet Leadership & Character Building',
      urdu: 'قیادت اور اخلاقی تربیت',
      icon: Award,
      image: '/images/pts_police_cadets.jpg',
      desc: 'Cultivating leadership, emotional stamina, anti-corruption mindset, and courteous public dealing under high stress situations.',
      points: ['Emotional Intelligence & Stress Management', 'Citizen Assistance Protocols', 'Public Ethics Seminars', 'Community Liaison Workshops']
    }
  ];

  const galleryItems = [
    {
      id: 1,
      category: 'parade',
      title: 'Grand Passing-Out Ceremonial Parade',
      desc: 'Recruits on the historic parade arena taking their oath of allegiance in synchronized battalion formation.',
      image: '/images/pts_hero_parade.jpg',
      tag: 'Parade Arena'
    },
    {
      id: 2,
      category: 'tactical',
      title: 'Tactical Obstacle & Endurance Training',
      desc: 'Cadets scaling training walls, negotiating trenches, and building combat resilience in full tactical gear.',
      image: '/images/pts_tactical_drill.jpg',
      tag: 'Field Operations'
    },
    {
      id: 3,
      category: 'academic',
      title: 'Digital Forensic & Criminal Law Lecture Hall',
      desc: 'Cadets analyzing case studies and legal statutes in the multimedia forensic instructional auditorium.',
      image: '/images/pts_smart_class.jpg',
      tag: 'Smart Classrooms'
    },
    {
      id: 4,
      category: 'campus',
      title: 'Historic Main Gate & Quarter Guard Entrance',
      desc: 'The iconic colonial red-brick academy facade, national flag post, and ceremonial guard tower.',
      image: '/images/pts_campus_main.jpg',
      tag: 'Heritage Campus'
    },
    {
      id: 5,
      category: 'parade',
      title: 'Passing Out Cohort of Officers & Cadets',
      desc: 'Proud male and female police officers standing tall in front of the academy memorial archway.',
      image: '/images/pts_police_cadets.jpg',
      tag: 'Elite Cadets'
    }
  ];

  const filteredGallery = activeGalleryTab === 'all' 
    ? galleryItems 
    : galleryItems.filter(item => item.category === activeGalleryTab);

  const campusAmenities = [
    { title: 'Historic Parade Arena', desc: 'Spacious parade grounds designed to host full battalion ceremonial reviews and passing-out inspections.' },
    { title: 'Tactical Obstacle Course', desc: 'Custom-designed endurance training tracks including scaling walls, ropes, and combat trenches.' },
    { title: 'Multimedia Lecture Theaters', desc: 'Air-conditioned smart classrooms equipped for modern legal instruction, forensics, and case discussions.' },
    { title: 'Cadet Barracks & Messing Halls', desc: 'Clean, comfortable living barracks with filtered water plants, nutritional dining halls, and indoor recreation.' },
    { title: 'Dispensary & Health Complex', desc: '24/7 on-campus medical response with dedicated physicians, emergency ambulances, and regular fitness exams.' },
    { title: 'Spiritual Mosque & Library', desc: 'Central mosque and comprehensive legal library housing legal journals, criminal law treatises, and historical archives.' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070b14] text-slate-800 dark:text-slate-100 selection:bg-indigo-600 selection:text-white transition-colors duration-300">
      {/* Top Official Gov Bar */}
      <div className="bg-[#0b1528] text-slate-300 text-xs py-2 px-4 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold text-white tracking-wide">Government of Punjab</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">Punjab Police Official Training Institution</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="hidden md:inline text-amber-300 font-serif tracking-wider font-semibold">
              خدمت اور تحفظ • Training for Service
            </span>
            <span className="text-slate-500 hidden md:inline">•</span>
            <a href="tel:0489230118" className="hover:text-white flex items-center gap-1 transition-colors">
              <Phone className="w-3 h-3 text-emerald-400" />
              <span>048-9230118</span>
            </a>
            <a href="mailto:pr.ptssgd@punjabpolice.gov.pk" className="hover:text-white hidden lg:flex items-center gap-1 transition-colors">
              <Mail className="w-3 h-3 text-indigo-400" />
              <span>pr.ptssgd@punjabpolice.gov.pk</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 dark:bg-[#080f22]/95 backdrop-blur-md shadow-md border-b border-slate-200 dark:border-white/10 py-2.5' : 'bg-white dark:bg-[#080f22] border-b border-slate-200/80 dark:border-white/10 py-3.5'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Brand Logo & Name */}
          <Link to="/" className="flex items-center gap-3.5 group text-left">
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-slate-900 p-1 flex items-center justify-center shadow-lg border-2 border-amber-400/50 group-hover:scale-105 transition-transform shrink-0">
              <img
                src={branding.logo_url || '/pts_logo.png'}
                alt="Police Training School Sargodha Crest"
                className="w-full h-full object-contain filter drop-shadow"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/pts_logo.png';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-amber-400 transition-colors">
                  PTS SARGODHA
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase tracking-widest hidden sm:inline-block">
                  PUNJAB POLICE
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-none mt-0.5">
                Police Training School Sargodha
              </p>
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-300 font-serif leading-none mt-1">
                پولیس ٹریننگ سکول سرگودھا — پنجاب پولیس
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-[13.5px] font-semibold text-slate-700 dark:text-slate-300">
            <a href="#about" className="hover:text-indigo-600 dark:hover:text-amber-400 transition-colors">About Academy</a>
            <a href="#pillars" className="hover:text-indigo-600 dark:hover:text-amber-400 transition-colors">Core Pillars</a>
            <a href="#wings" className="hover:text-indigo-600 dark:hover:text-amber-400 transition-colors">Training Wings</a>
            <a href="#gallery" className="hover:text-indigo-600 dark:hover:text-amber-400 transition-colors">Campus Life</a>
            <a href="#facilities" className="hover:text-indigo-600 dark:hover:text-amber-400 transition-colors">Facilities</a>
            <a href="#contact" className="hover:text-indigo-600 dark:hover:text-amber-400 transition-colors">Contact</a>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-all cursor-pointer"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Portal Entry Button */}
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="hidden sm:inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <Shield className="w-4 h-4 text-amber-400 dark:text-slate-950" />
                <span>Go to Portal ({user?.username || 'Officer'})</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="hidden sm:inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>Cadet & Staff Portal</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-Out Drawer Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#091122] px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl mb-2">
              <div className="w-10 h-10 rounded-full bg-slate-900 p-1 flex items-center justify-center border border-amber-400/40 shrink-0">
                <img src="/pts_logo.png" alt="PTS Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">PTS Sargodha Official Portal</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-300 font-serif">پولیس ٹریننگ سکول سرگودھا</p>
              </div>
            </div>

            <nav className="flex flex-col space-y-1 text-sm font-semibold">
              <a
                href="#about"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
              >
                About Academy
              </a>
              <a
                href="#pillars"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
              >
                Core Pillars
              </a>
              <a
                href="#wings"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
              >
                Training Wings
              </a>
              <a
                href="#gallery"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
              >
                Campus Life & Gallery
              </a>
              <a
                href="#facilities"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
              >
                Campus Facilities
              </a>
              <a
                href="#contact"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
              >
                Official Contact
              </a>
            </nav>

            <div className="pt-3 border-t border-slate-200 dark:border-white/10">
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/dashboard');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Shield className="w-4 h-4 text-amber-400 dark:text-slate-950" />
                  <span>Open Officer Portal</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-amber-300" />
                  <span>Sign In to Portal</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section with Light / Dark Balanced Masterpiece */}
      <section className="relative overflow-hidden pt-10 pb-16 lg:pt-14 lg:pb-20 bg-gradient-to-b from-white via-slate-50 to-[#f1f5f9] dark:from-[#080f22] dark:via-[#070d1c] dark:to-[#050914] border-b border-slate-200 dark:border-white/10">
        {/* Subtle mesh background effect */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Hero Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Badge Chips */}
              <div className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-indigo-50 dark:bg-amber-400/20 text-indigo-700 dark:text-amber-300 border border-indigo-200 dark:border-amber-400/30 text-xs font-bold uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-amber-300" />
                  Punjab Police Training Directorate
                </span>
                <span className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full bg-amber-50 dark:bg-white/10 text-amber-800 dark:text-slate-200 border border-amber-200 dark:border-white/20 text-xs font-bold tracking-wide">
                  <Award className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  Estd. Historic Institution
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] text-slate-900 dark:text-white">
                Police Training School <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-900 dark:from-amber-300 dark:via-yellow-200 dark:to-amber-400">
                  Sargodha
                </span>
              </h1>

              {/* Urdu Title & Sacred Calligraphy Note */}
              <div className="space-y-1">
                <p className="text-xl sm:text-2xl font-serif text-indigo-900 dark:text-amber-200 font-semibold tracking-wide">
                  پولیس ٹریننگ سکول سرگودھا — رب زدنی علما
                </p>
                <p className="text-xs sm:text-sm font-serif text-slate-600 dark:text-slate-300 italic tracking-wider">
                  خدمت اور تحفظ کا علمبردار • Training for Service
                </p>
              </div>

              {/* Mission Statement */}
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal">
                A prestigious cradle of discipline, tactical readiness, and ethical policing. Dedicated to transforming recruits into courageous, legally competent, and honorable guardians of peace for the people of Punjab.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                {isAuthenticated ? (
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-gradient-to-r dark:from-amber-500 dark:to-amber-600 dark:hover:from-amber-400 text-white dark:text-slate-950 font-black text-sm shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    <Shield className="w-5 h-5 text-amber-400 dark:text-slate-950" />
                    <span>Enter Officer Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-sm shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-amber-300" />
                    <span>Cadet & Staff Portal Login</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <a
                  href="#gallery"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-800 dark:text-white font-semibold text-sm border border-slate-300 dark:border-white/20 shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Explore Campus & Life</span>
                </a>

                <a
                  href="#wings"
                  className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs border border-slate-200 dark:border-white/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Training Wings</span>
                </a>
              </div>
            </div>

            {/* Hero Right: Big PTS Crest Showcase */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-amber-500/20 rounded-full blur-2xl group-hover:opacity-100 transition-opacity"></div>
                
                <div className="relative w-64 h-64 sm:w-76 sm:h-76 md:w-88 md:h-88 rounded-full bg-white dark:bg-slate-950 p-3.5 border-4 border-amber-400/60 shadow-2xl shadow-indigo-900/10 dark:shadow-black flex items-center justify-center">
                  <img
                    src="/pts_logo.png"
                    alt="Police Training School Sargodha Crest"
                    className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.2)] dark:drop-shadow-[0_12px_24px_rgba(0,0,0,0.9)] transform group-hover:scale-103 transition-transform duration-500"
                  />
                  
                  {/* Floating Pill Under Logo */}
                  <div className="absolute -bottom-3 bg-slate-900 text-white border border-amber-400/80 px-5 py-1.5 rounded-full shadow-xl text-center">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                      Police Training School Sargodha
                    </span>
                    <span className="text-[10px] text-slate-300 font-serif">
                      رب زدنی علما • Training for Service
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Stats Counter Grid */}
      <section className="relative z-20 -mt-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#0b1326]/95 rounded-2xl p-5 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-white/10 flex items-start gap-4 transition-all hover:border-amber-400/50 hover:-translate-y-0.5"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-amber-400/10 text-indigo-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-indigo-100 dark:border-amber-400/20">
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {stat.value}
                </p>
                <p className="text-xs font-bold text-slate-700 dark:text-amber-300 mt-0.5">
                  {stat.label}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {stat.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Core Institutional Pillars */}
      <section id="pillars" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-3 border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            Guiding Philosophy
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            The Pillars of Policing Excellence
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Every recruit who passes through the gates of PTS Sargodha is anchored upon four immutable tenets of honor and public duty.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {institutionalPillars.map((pillar, i) => (
            <div
              key={i}
              className="group relative rounded-3xl bg-white dark:bg-[#0d172e] p-6 border border-slate-200 dark:border-white/10 hover:border-amber-400/50 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden"
            >
              <div>
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${pillar.accent}`}>
                  <pillar.icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {pillar.title}
                </h3>
                <p className="text-xs font-serif text-amber-700 dark:text-amber-300 mt-0.5 font-semibold">
                  {pillar.urdu}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
                  {pillar.desc}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center text-[11px] text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-amber-400 transition-colors font-medium">
                <span>Tradition & Valor</span>
                <ChevronRight className="w-3.5 h-3.5 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Visual Campus Life & Gallery Showcase (Using AI Photography) */}
      <section id="gallery" className="py-20 bg-slate-100/70 dark:bg-[#060c18] border-y border-slate-200 dark:border-white/10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2.5 border border-indigo-500/20">
                <Compass className="w-3.5 h-3.5" />
                Campus & Training Life
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Life Inside Police Training School Sargodha
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                A glimpse into the daily crucible of drill, academic study, tactical endurance, and camaraderie.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'parade', 'tactical', 'academic', 'campus'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveGalleryTab(tab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                    activeGalleryTab === tab
                      ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 shadow-md'
                      : 'bg-white text-slate-700 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 border border-slate-200 dark:border-white/5'
                  }`}
                >
                  {tab === 'all' ? 'All Visuals' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Photo Gallery Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGallery.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-3xl overflow-hidden bg-white dark:bg-[#0d162b] border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl hover:border-indigo-400/50 dark:hover:border-amber-400/50 transition-all flex flex-col"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20"></div>
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                    {item.tag}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-amber-300 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                    <span>PTS Sargodha Cadre</span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Official Academy Campus</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About PTS Sargodha & Commandant's Message */}
      <section id="about" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Narrative */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider border border-amber-500/20">
              <Building2 className="w-3.5 h-3.5" />
              Institutional Heritage
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              A Historic Legacy of Guarding Peace in Punjab
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              The <strong>Police Training School (PTS) Sargodha</strong> stands as one of the oldest, most revered police academies in Pakistan. Operating directly under the administrative oversight of the Punjab Police Training Directorate, PTS Sargodha is mandated with turning recruits and in-service officers into resilient, compassionate, and tactical defenders of justice.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Over the decades, tens of thousands of constables, head constables, and specialized personnel have marched on these parade grounds, acquiring mastery over modern law, riot management, unarmed defense, and community policing.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#0b1326] border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Tactical Parades & Drills
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Batallion ceremonial formations, smart guard duties, and sharp marksmanship standards.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-[#0b1326] border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Modern Legal Education
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  CrPC, Pakistan Penal Code, Evidence Act, and case diary drafting instructed by experienced jurists.
                </p>
              </div>
            </div>
          </div>

          {/* Right Message Card (Styled like an official Executive Citation) */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl bg-gradient-to-br from-[#0c162e] to-[#060b17] text-white p-7 sm:p-9 shadow-2xl border-2 border-amber-400/40 overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl"></div>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-amber-400/50 p-1 flex items-center justify-center shrink-0">
                  <img src="/pts_logo.png" alt="PTS Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Principal / Commandant</h3>
                  <p className="text-xs text-amber-300 font-serif font-semibold">پیغام پرنسپل / کمانڈنٹ پی ٹی ایس سرگودھا</p>
                  <p className="text-[11px] text-slate-300">Police Training School Sargodha</p>
                </div>
              </div>

              <blockquote className="text-xs sm:text-[13px] text-slate-300 italic leading-relaxed space-y-3">
                <p>
                  “Policing is not merely a job; it is an honorable covenant to defend the life, property, and dignity of our citizens. At PTS Sargodha, our unyielding mission is to transform young recruits into disciplined, brave, and public-friendly protectors of the law.”
                </p>
                <p>
                  “Through rigorous tactical training and ethical enlightenment, we ensure that every graduate departs with deep reverence for justice and absolute commitment to our sacred motto: <span className="text-amber-300 font-bold not-italic font-serif">خدمت اور تحفظ — Training for Service</span>.”
                </p>
              </blockquote>

              <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-white">Commandant Office</p>
                  <p className="text-[10px] text-slate-400">PTS Sargodha, Punjab Police</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 font-mono text-[10px] uppercase tracking-wider border border-amber-400/30">
                  Official Desk
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specialized Training Wings (Updated Card UI with Imagery) */}
      <section id="wings" className="py-20 bg-slate-100/60 dark:bg-[#060c18] border-y border-slate-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-3 border border-amber-500/20">
              <Target className="w-3.5 h-3.5" />
              Specialized Divisions
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Institutional Training Wings
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Comprehensive directorates providing 360-degree instruction across military parade, criminal law, and physical endurance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {trainingWings.map((wing) => (
              <div
                key={wing.id}
                className="group rounded-3xl bg-white dark:bg-[#0b1428] border border-slate-200 dark:border-white/10 hover:border-indigo-400/50 dark:hover:border-amber-400/50 shadow-sm hover:shadow-xl overflow-hidden transition-all flex flex-col justify-between"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img
                    src={wing.image}
                    alt={wing.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                  <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-white">{wing.title}</h3>
                      <p className="text-xs font-serif text-amber-300">{wing.urdu}</p>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-amber-400/20 backdrop-blur-md border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
                      <wing.icon className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-4 flex-1 flex flex-col justify-between space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {wing.desc}
                  </p>

                  <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-bold text-indigo-700 dark:text-amber-400/80 uppercase tracking-wider mb-2.5">Key Curriculum Focus</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {wing.points.map((pt, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Campus Facilities Showcase */}
      <section id="facilities" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3 border border-emerald-500/20">
            <Building2 className="w-3.5 h-3.5" />
            Academy Infrastructure
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            World-Class Campus & Amenities
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Providing an optimal environment for physical discipline, intellectual growth, and tactical stamina.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {campusAmenities.map((facility, idx) => (
            <div
              key={idx}
              className="p-6 rounded-3xl bg-white dark:bg-[#0b1326] border border-slate-200 dark:border-white/10 hover:border-indigo-400/40 dark:hover:border-amber-400/40 hover:shadow-lg transition-all shadow-sm"
            >
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-amber-400/15 border border-indigo-100 dark:border-amber-400/30 text-indigo-600 dark:text-amber-300 flex items-center justify-center mb-3">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{facility.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{facility.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Official Location & Correspondence Desk */}
      <section id="contact" className="py-20 bg-slate-100/70 dark:bg-[#060c18] border-t border-slate-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider border border-amber-500/20">
                <MapPin className="w-3.5 h-3.5" />
                Official Headquarters
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Police Training School Sargodha
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                For official correspondence, cadet verification, or academy inquiries, contact the central administrative reception desk.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-[#0b1428] border border-slate-200 dark:border-white/10 shadow-sm">
                  <MapPin className="w-5 h-5 text-indigo-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Campus Location</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Police Training School, Faisalabad Road / Cantt Area, Sargodha, Punjab, Pakistan
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-[#0b1428] border border-slate-200 dark:border-white/10 shadow-sm">
                  <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Telephone & Fax Desk</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Direct: <a href="tel:0489230118" className="hover:underline text-indigo-600 dark:text-amber-400">048-9230118</a>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Fax Line: 048-9230518
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-[#0b1428] border border-slate-200 dark:border-white/10 shadow-sm">
                  <Mail className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Official Correspondence Email</p>
                    <a href="mailto:pr.ptssgd@punjabpolice.gov.pk" className="text-xs text-indigo-600 dark:text-amber-400 hover:underline">
                      pr.ptssgd@punjabpolice.gov.pk
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Portal Gateway Card */}
            <div className="lg:col-span-7 bg-white dark:bg-[#0b1428] p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-xl space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 p-1 flex items-center justify-center shrink-0">
                  <img src="/pts_logo.png" alt="PTS Crest" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Official Cadre & Staff Portal
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Secure gateway for instructional faculty, administrative supervisors, and police commandants.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">Administrative Access</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                      Access official staff directories, cadet records, company rosters, and administrative settings.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Officer Sign In →
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">Company Commander Display</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                      Launch the high-visibility muster review display designed for quarter guard gates and company commanders.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/live-screen')}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 text-xs font-black transition-all cursor-pointer"
                  >
                    Launch Kiosk Screen →
                  </button>
                </div>
              </div>

              <div className="pt-3 text-[11px] text-slate-500 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <span>Helpline: Punjab Police 15</span>
                <span>PTS Sargodha • Punjab Police</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Footer */}
      <footer className="bg-[#0b1528] text-slate-400 text-xs py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-amber-400/40 p-1 flex items-center justify-center">
                  <img src="/pts_logo.png" alt="PTS Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Police Training School Sargodha</p>
                  <p className="text-[10px] text-amber-300 font-serif font-semibold">حکومتِ پنجاب • پنجاب پولیس</p>
                </div>
              </div>
              <p className="text-slate-400 text-xs max-w-md leading-relaxed">
                Dedicated to cultivating police professionals of unyielding integrity, supreme physical fitness, sound legal knowledge, and high humanitarian standards.
              </p>
            </div>

            <div>
              <p className="font-bold text-white text-xs uppercase tracking-wider mb-3">Institutional Links</p>
              <ul className="space-y-2 text-slate-400">
                <li><a href="https://punjabpolice.gov.pk" target="_blank" rel="noopener noreferrer" className="hover:text-amber-300 flex items-center gap-1">Punjab Police Official <ExternalLink className="w-3 h-3" /></a></li>
                <li><a href="#about" className="hover:text-amber-300">About Academy</a></li>
                <li><a href="#pillars" className="hover:text-amber-300">Core Pillars</a></li>
                <li><a href="#wings" className="hover:text-amber-300">Training Wings</a></li>
                <li><a href="#gallery" className="hover:text-amber-300">Campus Visuals</a></li>
              </ul>
            </div>

            <div>
              <p className="font-bold text-white text-xs uppercase tracking-wider mb-3">Direct Academy Desk</p>
              <ul className="space-y-2 text-slate-400">
                <li><Link to="/login" className="hover:text-amber-300">Cadet & Staff Portal</Link></li>
                <li><Link to="/live-screen" className="hover:text-amber-300">Quarter Guard Kiosk</Link></li>
                <li><a href="tel:0489230118" className="hover:text-amber-300">Telephone: 048-9230118</a></li>
                <li><a href="mailto:pr.ptssgd@punjabpolice.gov.pk" className="hover:text-amber-300">Email: pr.ptssgd@punjabpolice.gov.pk</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
            <p>© {new Date().getFullYear()} Police Training School Sargodha, Punjab Police. All rights reserved.</p>
            <p className="flex items-center gap-2">
              <span className="text-amber-300 font-serif font-medium">خدمت اور تحفظ</span>
              <span>•</span>
              <span className="text-slate-400">Training for Service</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
