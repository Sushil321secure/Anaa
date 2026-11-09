import { Route, Routes } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout.jsx';
import PortalLayout from '../layouts/PortalLayout.jsx';
import RequireRole, { RequireAnyRole } from '../features/auth/RequireRole.jsx';
import About from '../pages/About.jsx';
import Faqs from '../pages/Faqs.jsx';
import Contact from '../pages/Contact.jsx';
import Services from '../pages/Services.jsx';
import ProgramDetail from '../pages/ProgramDetail.jsx';
import WellnessTrip from '../pages/WellnessTrip.jsx';
import SchoolWorkshops from '../pages/SchoolWorkshops.jsx';
import CorporateWorkshops from '../pages/CorporateWorkshops.jsx';
import Packages from '../pages/Packages.jsx';
import ConsultationRoom from '../pages/ConsultationRoom.jsx';
import DiscoveryCall from '../pages/DiscoveryCall.jsx';
import Home from '../pages/Home.jsx';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import ForgotPassword from '../pages/ForgotPassword.jsx';
import ResetPassword from '../pages/ResetPassword.jsx';
import NotFound from '../pages/NotFound.jsx';
import CustomerDashboard from '../pages/CustomerDashboard.jsx';
import CustomerAppointments from '../pages/CustomerAppointments.jsx';
import CustomerPackages from '../pages/CustomerPackages.jsx';
import CustomerDietPlans from '../pages/CustomerDietPlans.jsx';
import CustomerProgress from '../pages/CustomerProgress.jsx';
import CustomerRewards from '../pages/CustomerRewards.jsx';
import CustomerProfile from '../pages/CustomerProfile.jsx';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import AdminEnquiries from '../pages/AdminEnquiries.jsx';
import AdminCustomers from '../pages/AdminCustomers.jsx';
import AdminCustomerDetail from '../pages/AdminCustomerDetail.jsx';
import AdminAppointments from '../pages/AdminAppointments.jsx';
import AdminCatalogue from '../pages/AdminCatalogue.jsx';
import AdminTestimonials from '../pages/AdminTestimonials.jsx';
import AdminStaff from '../pages/AdminStaff.jsx';
import AdminSettings from '../pages/AdminSettings.jsx';
import AdminRewards from '../pages/AdminRewards.jsx';
import VerifyEmail from '../pages/VerifyEmail.jsx';
import BookConsultation from '../pages/BookConsultation.jsx';
import LogAndEarn from '../pages/LogAndEarn.jsx';
import OnlineYoga from '../pages/OnlineYoga.jsx';
import MyProfile from '../pages/MyProfile.jsx';
import CustomerYoga from '../pages/yoga/CustomerYoga.jsx';
import AdminYoga from '../pages/yoga/AdminYoga.jsx';
import YogaSessionDetail from '../pages/yoga/YogaSessionDetail.jsx';

const MANAGERS = ['OWNER', 'ADMIN'];
const ALL_STAFF = ['OWNER', 'ADMIN', 'DIETITIAN', 'OPERATIONS'];

const customerNav = [
  { to: '/portal', label: 'Dashboard', icon: 'home', end: true },
  { to: '/portal/appointments', label: 'Appointments', icon: 'calendar' },
  { to: '/portal/packages', label: 'My packages', icon: 'package' },
  { to: '/portal/diet-plans', label: 'Diet plans', icon: 'file' },
  { to: '/portal/yoga', label: 'Online yoga', icon: 'leaf' },
  { to: '/portal/progress', label: 'Progress', icon: 'chart' },
  { to: '/portal/rewards', label: 'Log & Earn', icon: 'gift' },
  { to: '/portal/profile', label: 'My profile', icon: 'user' },
];

const staffNav = [
  { to: '/admin', label: 'Overview', icon: 'home', end: true },
  { to: '/admin/enquiries', label: 'Enquiries', icon: 'mail', roles: ['OWNER', 'ADMIN', 'OPERATIONS'] },
  { to: '/admin/customers', label: 'Customers', icon: 'users' },
  { to: '/admin/appointments', label: 'Appointments', icon: 'calendar' },
  { to: '/admin/yoga', label: 'Yoga sessions', icon: 'leaf', roles: ['OWNER', 'ADMIN', 'DIETITIAN'] },
  { to: '/admin/catalogue', label: 'Packages & services', icon: 'package', roles: MANAGERS },
  { to: '/admin/testimonials', label: 'Testimonials', icon: 'star', roles: MANAGERS },
  { to: '/admin/rewards', label: 'Log & Earn', icon: 'gift', roles: MANAGERS },
  { to: '/admin/staff', label: 'Staff', icon: 'stethoscope', roles: MANAGERS },
  { to: '/admin/settings', label: 'Settings', icon: 'settings', roles: MANAGERS },
  { to: '/admin/profile', label: 'My profile', icon: 'user' },
];

const only = (roles, element) => <RequireAnyRole roles={roles}>{element}</RequireAnyRole>;

export default function App() {
  return (
    <Routes>
      <Route path="consultation/:id" element={<ConsultationRoom />} />
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="faqs" element={<Faqs />} />
        <Route path="contact" element={<Contact />} />
        <Route path="services" element={<Services />} />
        <Route path="programs/:slug" element={<ProgramDetail />} />
        <Route path="wellness-trip" element={<WellnessTrip />} />
        <Route path="school-wellness-workshops" element={<SchoolWorkshops />} />
        <Route path="corporate-workshops" element={<CorporateWorkshops />} />
        <Route path="packages" element={<Packages />} />
        <Route path="online-yoga" element={<OnlineYoga />} />
        <Route path="book-consultation" element={<BookConsultation />} />
        <Route path="discovery-call" element={<DiscoveryCall />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="log-and-earn" element={<LogAndEarn />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="portal" element={<RequireRole area="customer"><PortalLayout title="My Portal" nav={customerNav} /></RequireRole>}>
        <Route index element={<CustomerDashboard />} />
        <Route path="appointments" element={<CustomerAppointments />} />
        <Route path="packages" element={<CustomerPackages />} />
        <Route path="diet-plans" element={<CustomerDietPlans />} />
        <Route path="yoga" element={<CustomerYoga />} />
        <Route path="progress" element={<CustomerProgress />} />
        <Route path="rewards" element={<CustomerRewards />} />
        <Route path="profile" element={<CustomerProfile />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="admin" element={<RequireRole area="staff"><PortalLayout title="Admin Portal" nav={staffNav} /></RequireRole>}>
        <Route index element={<AdminDashboard />} />
        <Route path="enquiries" element={only(['OWNER', 'ADMIN', 'OPERATIONS'], <AdminEnquiries />)} />
        <Route path="customers" element={only(ALL_STAFF, <AdminCustomers />)} />
        <Route path="customers/:id" element={only(ALL_STAFF, <AdminCustomerDetail />)} />
        <Route path="appointments" element={only(ALL_STAFF, <AdminAppointments />)} />
        <Route path="yoga" element={only(['OWNER', 'ADMIN', 'DIETITIAN'], <AdminYoga />)} />
        <Route path="yoga/:id" element={only(['OWNER', 'ADMIN', 'DIETITIAN'], <YogaSessionDetail />)} />
        <Route path="catalogue" element={only(MANAGERS, <AdminCatalogue />)} />
        <Route path="testimonials" element={only(MANAGERS, <AdminTestimonials />)} />
        <Route path="rewards" element={only(MANAGERS, <AdminRewards />)} />
        <Route path="staff" element={only(MANAGERS, <AdminStaff />)} />
        <Route path="profile" element={<MyProfile />} />
        <Route path="settings" element={only(MANAGERS, <AdminSettings />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
