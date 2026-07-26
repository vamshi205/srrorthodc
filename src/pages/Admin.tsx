import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddProcedureForm } from '@/components/admin/AddProcedureForm';
import { TopToolbar } from '@/components/ortho/TopToolbar';
import { useProcedures } from '@/hooks/useProcedures';
import { auth } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const Admin = () => {
  const navigate = useNavigate();
  const { fetchProcedures, loading } = useProcedures();

  const [adminAccessOpen, setAdminAccessOpen] = useState(true);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);

  const confirmAdminAccess = () => {
    if (adminPassword.trim() !== 'srrortho') {
      setPasswordError('Incorrect password. Please try again.');
      return;
    }
    setPasswordError('');
    setIsAdminAuthorized(true);
    setAdminAccessOpen(false);
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('srrortho:theme') as 'light' | 'dark') || 'dark';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('srrortho:theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("srrortho:auth");
    localStorage.removeItem('srrortho:procedures_cache');
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero overflow-x-hidden">
      <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <TopToolbar
          theme={theme}
          toggleTheme={toggleTheme}
          fetchProcedures={fetchProcedures}
          loading={loading}
          handlePrint={() => {}}
          navigate={navigate}
          handleLogout={handleLogout}
          setDcMode={(mode) => navigate(`/?mode=${mode}`)}
          setInitialFilterType={() => {}}
          setShowProcedureSelector={() => {}}
          setActiveProcedures={() => {}}
          setCollapsedProcedures={() => {}}
        />

        <Dialog
          open={adminAccessOpen}
          onOpenChange={(open) => {
            if (!open && !isAdminAuthorized) navigate('/');
            setAdminAccessOpen(open);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Admin Access</DialogTitle>
              <DialogDescription>Enter the administrator password to open the Admin panel.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="admin-access-password">Password</Label>
              <Input
                id="admin-access-password"
                type="password"
                autoFocus
                value={adminPassword}
                onChange={(event) => {
                  setAdminPassword(event.target.value);
                  setPasswordError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') confirmAdminAccess();
                }}
              />
              {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => navigate('/')}>Cancel</Button>
                <Button onClick={confirmAdminAccess}>Enter Admin Panel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {isAdminAuthorized && (
          <main className="container mx-auto max-w-4xl py-4 sm:py-6">
            <div className="space-y-6">
              <AddProcedureForm />
            </div>
          </main>
        )}
      </div>
    </div>
  );
};

export default Admin;

