import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { AIHubMain } from "./aihub-main";
import {
  getAIHubAccessStatusFn,
  verifyAIHubPasscodeFn,
} from "@/services/aihub.server";

export function AIHubAccess() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [accessStatus, setAccessStatus] = useState<{
    enabled: boolean;
    requiresPasscode: boolean;
  } | null>(null);
  const [passcode, setPasscode] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [showPasscode, setShowPasscode] = useState(false);

  // Check access status on mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const data = await getAIHubAccessStatusFn();
        if (data.error) {
          setError(data.error);
          setCheckingAccess(false);
          return;
        }
        setAccessStatus({
          enabled: data.enabled,
          requiresPasscode: data.requiresPasscode ?? false,
        });

        if (!data.enabled) {
          setError(
            "This section is available only to selected users.",
          );
        }
      } catch (err) {
        setError("Failed to check access status");
      } finally {
        setCheckingAccess(false);
      }
    };

    if (user) {
      checkAccess();
    } else {
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await verifyAIHubPasscodeFn({ data: { passcode } });

      if (data.error) {
        setError(data.error || "Invalid passcode");
        return;
      }

      // Store token in sessionStorage for this session
      sessionStorage.setItem("aihub_token", data.token);
      setVerified(true);
    } catch (err) {
      setError("Failed to verify passcode");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!accessStatus?.enabled) {
    return (
      <div className="max-w-2xl mx-auto mt-12 px-4">
        <Alert className="border-red-200 bg-red-50 mb-6">
          <AlertDescription className="text-red-800">
            <p className="font-bold text-lg text-center">
              🔒 This section is available only to selected users.
            </p>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-6">
            ✨ Sorry But currently it has limits 
          </h3>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1 */}
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition">
              <div className="text-3xl mb-2">📸</div>
              <h4 className="font-bold text-blue-900 mb-2">Snap & Get Graded</h4>
              <p className="text-sm text-blue-800">
                Take a photo of your handwritten answers and get instant AI evaluation with detailed scoring.
              </p>
            </Card>

            {/* Card 2 */}
            <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition">
              <div className="text-3xl mb-2">🧠</div>
              <h4 className="font-bold text-purple-900 mb-2">Smart Feedback</h4>
              <p className="text-sm text-purple-800">
                Get AI-powered insights on what you got wrong and how to improve your answers.
              </p>
            </Card>

            {/* Card 3 */}
            <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition">
              <div className="text-3xl mb-2">📊</div>
              <h4 className="font-bold text-green-900 mb-2">Track Progress</h4>
              <p className="text-sm text-green-800">
                Monitor your performance topic-by-topic and see your improvement over time.
              </p>
            </Card>

            {/* Card 4 */}
            <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition">
              <div className="text-3xl mb-2">🎯</div>
              <h4 className="font-bold text-orange-900 mb-2">Model Answers</h4>
              <p className="text-sm text-orange-800">
                View AI-generated perfect answers to learn the right way to answer exam questions.
              </p>
            </Card>
          </div>

          {/* Why Limited */}
          <div className="bg-gray-100 p-4 rounded-lg mt-6">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Why limited access?</span> AI Hub uses advanced Google Gemini APIs with free-tier request limits. I will try to find a free API to give you access but for now sorry.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (verified) {
    return <AIHubMain />;
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4 text-center">AI Hub Access</h2>
        <p className="text-gray-600 mb-6 text-center">
          Enter your AI Hub passcode to continue
        </p>

        {error && (
          <Alert className="border-red-200 bg-red-50 mb-4">
            <AlertDescription className="text-red-800 text-sm">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleVerifyPasscode}>
          <div className="mb-4">
            <div className="relative">
              <Input
                type={showPasscode ? "text" : "password"}
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                disabled={loading}
                className="text-center text-lg tracking-widest pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={loading}
              >
                {showPasscode ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !passcode}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
