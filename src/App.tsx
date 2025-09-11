import { Authenticated, Unauthenticated, useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useState } from "react";
import React from "react";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-primary">WhatsApp AI Assistant</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 p-8">
        <Content />
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Authenticated>
        <WhatsAppDashboard />
      </Authenticated>
      <Unauthenticated>
        <div className="flex flex-col items-center gap-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-primary mb-4">WhatsApp AI Assistant</h1>
            <p className="text-xl text-secondary">Sign in to manage your WhatsApp AI assistant</p>
          </div>
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}

function WhatsAppDashboard() {
  const contacts = useQuery(api.whatsapp.getContacts) || [];
  const [selectedContact, setSelectedContact] = useState<string>("");
  const [messageText, setMessageText] = useState("");
  const [sendToNumber, setSendToNumber] = useState("");
  const [activeTab, setActiveTab] = useState<"messages" | "ai-logs">("messages");
  
  const sendMessage = useAction(api.whatsapp.sendMessage);
  const messages = useQuery(
    api.whatsapp.getMessages,
    selectedContact ? { phoneNumber: selectedContact } : "skip"
  ) || [];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetNumber = selectedContact || sendToNumber;
    
    if (!targetNumber || !messageText.trim()) return;

    try {
      await sendMessage({
        to: targetNumber,
        body: messageText.trim(),
      });
      setMessageText("");
      setSendToNumber("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Status Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <div>
            <h3 className="font-semibold text-blue-900">AI Assistant Active</h3>
            <p className="text-sm text-blue-700">
              Your WhatsApp AI assistant is automatically responding to incoming messages
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contacts Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Contacts</h2>
          <div className="space-y-2">
            {contacts.length === 0 ? (
              <p className="text-gray-500">No contacts yet</p>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact._id}
                  onClick={() => setSelectedContact(contact.phoneNumber)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedContact === contact.phoneNumber
                      ? "bg-blue-50 border-blue-200"
                      : "hover:bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="font-medium">
                    {contact.name || contact.phoneNumber.replace("whatsapp:", "")}
                  </div>
                  {contact.lastMessageTime && (
                    <div className="text-sm text-gray-500">
                      {new Date(contact.lastMessageTime).toLocaleDateString()}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Messages Panel */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("messages")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "messages"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Messages
              </button>
              <button
                onClick={() => setActiveTab("ai-logs")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "ai-logs"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                AI Logs
              </button>
            </div>
            {selectedContact && (
              <button
                onClick={() => setSelectedContact("")}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear selection
              </button>
            )}
          </div>

          {activeTab === "messages" ? (
            <>
              {/* Messages List */}
              <div className="h-96 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50">
                {messages.length === 0 ? (
                  <p className="text-gray-500 text-center">
                    {selectedContact ? "No messages with this contact" : "Select a contact to view messages"}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.reverse().map((message) => (
                      <div
                        key={message._id}
                        className={`flex ${
                          message.direction === "outbound" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.direction === "outbound"
                              ? "bg-blue-500 text-white"
                              : "bg-white border"
                          }`}
                        >
                          <p className="text-sm">{message.body}</p>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs opacity-70">
                              {new Date(message._creationTime).toLocaleTimeString()}
                            </span>
                            {message.direction === "outbound" && (
                              <span className="text-xs opacity-70 ml-2">
                                {message.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Send Message Form */}
              <form onSubmit={handleSendMessage} className="space-y-3">
                {!selectedContact && (
                  <input
                    type="text"
                    placeholder="Phone number (e.g., +1234567890)"
                    value={sendToNumber}
                    onChange={(e) => setSendToNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || (!selectedContact && !sendToNumber)}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : (
            <AILogsPanel selectedContact={selectedContact} />
          )}
        </div>
      </div>
    </div>
  );
}

function AILogsPanel({ selectedContact }: { selectedContact: string }) {
  const aiLogs = useQuery(api.aiAgent.getAIInteractions, {
    phoneNumber: selectedContact || undefined,
    limit: 20,
  }) || [];

  return (
    <div className="h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50">
      {aiLogs.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-2">🤖</div>
          <p className="font-medium">AI Interaction Logs</p>
          <p className="text-sm mt-1">
            AI interaction logs will appear here once the system processes incoming messages
          </p>
          {selectedContact && (
            <p className="text-xs mt-2 text-blue-600">
              Filtered for: {selectedContact.replace("whatsapp:", "")}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {aiLogs.map((log) => (
            <div key={log._id} className="bg-white rounded p-3 border">
              <div className="text-xs text-gray-500 mb-2">
                {new Date(log.timestamp).toLocaleString()} - {log.phoneNumber.replace("whatsapp:", "")}
              </div>
              <div className="text-sm mb-1"><strong>User:</strong> {log.userMessage}</div>
              <div className="text-sm text-blue-700"><strong>AI:</strong> {log.aiResponse}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
