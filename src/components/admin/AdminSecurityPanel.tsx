import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AdminApi } from '@/services/api';
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Key, 
  Smartphone,
  Copy,
  RefreshCw,
  Settings
} from 'lucide-react';

const AdminSecurityPanel = () => {
  const { toast } = useToast();
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);

  // Enable 2FA
  const setup2FA = useCallback(async () => {
    try {
      setIsSettingUp2FA(true);
      
      // In a real implementation, this would call the backend to generate a secret
      const mockSecret = 'JBSWY3DPEHPK3PXP'; // Demo secret
      const mockQR = `otpauth://totp/Veilo%20Admin?secret=${mockSecret}&issuer=Veilo`;
      const mockBackupCodes = [
        '12345-67890',
        '23456-78901', 
        '34567-89012',
        '45678-90123',
        '56789-01234'
      ];
      
      setQrCode(mockQR);
      setBackupCodes(mockBackupCodes);
      
      toast({
        title: "2FA Setup Started",
        description: "Scan the QR code with your authenticator app",
      });
      
    } catch (error) {
      console.error('2FA setup error:', error);
      toast({
        title: "Setup Failed",
        description: "Failed to setup 2FA. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSettingUp2FA(false);
    }
  }, [toast]);

  // Verify and enable 2FA
  const enable2FA = useCallback(async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code",
        variant: "destructive"
      });
      return;
    }

    try {
      // In a real implementation, verify the code with the backend
      if (verificationCode === '123456') { // Demo verification
        setIs2FAEnabled(true);
        setQrCode('');
        setVerificationCode('');
        
        toast({
          title: "2FA Enabled",
          description: "Two-factor authentication has been successfully enabled",
        });
      } else {
        throw new Error('Invalid verification code');
      }
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: "Invalid verification code. Please try again.",
        variant: "destructive"
      });
    }
  }, [verificationCode, toast]);

  // Disable 2FA
  const disable2FA = useCallback(async () => {
    try {
      // In a real implementation, this would require password confirmation
      setIs2FAEnabled(false);
      setBackupCodes([]);
      
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disable 2FA",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Copy backup code
  const copyBackupCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: "Backup code copied to clipboard",
    });
  }, [toast]);

  // Generate new backup codes
  const generateNewBackupCodes = useCallback(() => {
    const newCodes = Array.from({ length: 5 }, (_, i) => 
      `${Math.random().toString().slice(2, 7)}-${Math.random().toString().slice(2, 7)}`
    );
    setBackupCodes(newCodes);
    
    toast({
      title: "New Backup Codes Generated",
      description: "Previous backup codes are no longer valid",
    });
  }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Security Settings</h2>
        <p className="text-muted-foreground">
          Manage your admin account security settings and two-factor authentication
        </p>
      </div>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Two-Factor Authentication (2FA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {is2FAEnabled ? 'Two-factor authentication is enabled' : 'Two-factor authentication is disabled'}
              </p>
              <p className="text-sm text-muted-foreground">
                {is2FAEnabled 
                  ? 'Your account is protected with an additional security layer'
                  : 'Add an extra layer of security to your admin account'
                }
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              {is2FAEnabled ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500" />
              )}
            </div>
          </div>

          {!is2FAEnabled && !qrCode && (
            <Button onClick={setup2FA} disabled={isSettingUp2FA}>
              <Smartphone className="h-4 w-4 mr-2" />
              {isSettingUp2FA ? 'Setting up...' : 'Enable 2FA'}
            </Button>
          )}

          {qrCode && !is2FAEnabled && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Step 1: Scan QR Code</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                
                {/* In a real implementation, you'd render an actual QR code here */}
                <div className="w-48 h-48 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center mx-auto">
                  <div className="text-center">
                    <Key className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-xs text-gray-500">QR Code</p>
                    <p className="text-xs text-gray-400 mt-1">Demo Mode</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Can't scan? Enter this key manually:</p>
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    JBSWY3DPEHPK3PXP
                  </code>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Step 2: Enter Verification Code</h4>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code from your authenticator app
                </p>
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="max-w-32"
                  />
                  <Button onClick={enable2FA} disabled={verificationCode.length !== 6}>
                    Verify & Enable
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Demo: Use code "123456" to complete setup
                </p>
              </div>
            </div>
          )}

          {is2FAEnabled && (
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Button variant="destructive" onClick={disable2FA}>
                  Disable 2FA
                </Button>
                <Button variant="outline" onClick={generateNewBackupCodes}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate New Backup Codes
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup Codes */}
      {backupCodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Key className="h-5 w-5 mr-2" />
              Backup Codes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Important Security Information</h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                <li>• Save these backup codes in a secure location</li>
                <li>• Each code can only be used once</li>
                <li>• Use them to access your account if you lose your authenticator device</li>
                <li>• Generate new codes if you suspect they've been compromised</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <code className="font-mono text-sm">{code}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyBackupCode(code)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button variant="outline" onClick={generateNewBackupCodes}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate New Codes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Security Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Use a Strong Password</p>
                <p className="text-sm text-muted-foreground">
                  Use a unique, complex password that's at least 12 characters long
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              {is2FAEnabled ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div>
                <p className="font-medium">Enable Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to protect your admin account
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Regular Security Reviews</p>
                <p className="text-sm text-muted-foreground">
                  Review your security settings and access logs regularly
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Secure Network Access</p>
                <p className="text-sm text-muted-foreground">
                  Always access the admin panel from a secure, trusted network
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSecurityPanel;