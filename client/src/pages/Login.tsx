import { useState } from "react";
import { useLocation } from "wouter";
import {
  useLogin,
  useForgotPasswordRequest,
  useForgotPasswordVerify,
  useForgotPasswordReset,
  useCreateUser,
  useSetupStatus,
} from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLogin();
  const requestOtp = useForgotPasswordRequest();
  const verifyOtp = useForgotPasswordVerify();
  const resetPassword = useForgotPasswordReset();
  const createUser = useCreateUser();
  const { data: setupStatus } = useSetupStatus();

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [setupForm, setSetupForm] = useState({
    fullName: "",
    username: "",
    phone: "",
    password: "",
  });
  const [resetForm, setResetForm] = useState({ phone: "", otp: "", newPassword: "" });
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync(loginForm);
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    }
  };

  const onRequestOtp = async () => {
    try {
      await requestOtp.mutateAsync({ phone: resetForm.phone });
      setOtpRequested(true);
      toast({ title: "OTP sent", description: "If phone exists, OTP has been sent." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const onVerifyOtp = async () => {
    try {
      await verifyOtp.mutateAsync({ phone: resetForm.phone, otp: resetForm.otp });
      setOtpVerified(true);
      toast({ title: "OTP verified" });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    }
  };

  const onResetPassword = async () => {
    try {
      await resetPassword.mutateAsync(resetForm);
      setOtpRequested(false);
      setOtpVerified(false);
      setResetForm({ phone: "", otp: "", newPassword: "" });
      toast({ title: "Password reset successful", description: "Please login with new password." });
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    }
  };

  const onSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser.mutateAsync({ ...setupForm, role: "admin" });
      toast({ title: "Admin account created", description: "You can now login." });
      setSetupForm({ fullName: "", username: "", phone: "", password: "" });
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>PlanFlow Access</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="forgot">Forgot Password</TabsTrigger>
              <TabsTrigger value="setup">Setup Admin</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={onLogin} className="space-y-3">
                <div className="space-y-1">
                  <Label>Username</Label>
                  <Input
                    value={loginForm.username}
                    onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                    required
                  />
                </div>
                <Button className="w-full" type="submit" disabled={login.isPending}>
                  {login.isPending ? "Signing in..." : "Login"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="forgot">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Phone Number</Label>
                  <Input
                    value={resetForm.phone}
                    onChange={(e) => setResetForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+15551234567"
                  />
                </div>
                <Button className="w-full" type="button" onClick={onRequestOtp} disabled={requestOtp.isPending || !resetForm.phone}>
                  {requestOtp.isPending ? "Sending OTP..." : "Send SMS OTP"}
                </Button>

                {otpRequested && (
                  <>
                    <div className="space-y-1">
                      <Label>OTP</Label>
                      <Input
                        value={resetForm.otp}
                        onChange={(e) => setResetForm((p) => ({ ...p, otp: e.target.value }))}
                        placeholder="6-digit code"
                      />
                    </div>
                    <Button className="w-full" type="button" variant="outline" onClick={onVerifyOtp} disabled={verifyOtp.isPending}>
                      {verifyOtp.isPending ? "Verifying..." : "Verify OTP"}
                    </Button>
                  </>
                )}

                {otpVerified && (
                  <>
                    <div className="space-y-1">
                      <Label>New Password</Label>
                      <Input
                        type="password"
                        value={resetForm.newPassword}
                        onChange={(e) => setResetForm((p) => ({ ...p, newPassword: e.target.value }))}
                      />
                    </div>
                    <Button className="w-full" type="button" onClick={onResetPassword} disabled={resetPassword.isPending}>
                      {resetPassword.isPending ? "Resetting..." : "Reset Password"}
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="setup">
              {!setupStatus?.canBootstrap && (
                <p className="text-sm text-muted-foreground mb-3">
                  Initial setup is already completed. Login with an existing admin account, then use the Users page to add more users.
                </p>
              )}
              <form onSubmit={onSetupAdmin} className="space-y-3">
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input value={setupForm.fullName} onChange={(e) => setSetupForm((p) => ({ ...p, fullName: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>Username</Label>
                  <Input value={setupForm.username} onChange={(e) => setSetupForm((p) => ({ ...p, username: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={setupForm.phone} onChange={(e) => setSetupForm((p) => ({ ...p, phone: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>Password</Label>
                  <Input type="password" value={setupForm.password} onChange={(e) => setSetupForm((p) => ({ ...p, password: e.target.value }))} required />
                </div>
                <Button className="w-full" type="submit" disabled={createUser.isPending || setupStatus?.canBootstrap === false}>
                  {createUser.isPending ? "Creating..." : "Create Admin Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
