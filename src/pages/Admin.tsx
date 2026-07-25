import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AddProcedureForm } from '@/components/admin/AddProcedureForm';
// import { migrateLocalStorageToSheets } from '@/lib/savedDcStorage';
// import { getConfigurationStatus } from '@/services/dcSheetsService';
// import { useToast } from '@/hooks/use-toast';

const Admin = () => {
  const navigate = useNavigate();
  // const { toast } = useToast();
  // const [isMigrating, setIsMigrating] = useState(false);
  // const configStatus = getConfigurationStatus();

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to DC Generator</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-display font-semibold">Admin Panel</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Add new procedures or edit existing ones with items and instruments
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Add Procedure Form */}
          <AddProcedureForm />
        </div>
      </main>
    </div>
  );
};

export default Admin;

